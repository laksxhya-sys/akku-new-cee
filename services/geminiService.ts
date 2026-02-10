import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { db } from './firebase';

// Models
const TEXT_MODEL = "gemini-3-flash-preview"; 
const FALLBACK_TEXT_MODEL = "gemini-2.5-flash"; 
const GEN_IMAGE_MODEL = "gemini-3-pro-image-preview"; 
const EDIT_IMAGE_MODEL = "gemini-2.5-flash-image"; 
const FALLBACK_IMAGE_MODEL = "gemini-2.5-flash-image"; 

let ai: GoogleGenAI | null = null;

const logErrorToDB = async (message: string) => {
    try {
        await db.collection('system_logs').add({
            type: 'ERROR',
            message: message,
            timestamp: Date.now(),
            source: 'GeminiService'
        });
    } catch (e) {
        console.error("Failed to log error to DB", e);
    }
};

export const getAI = () => {
  if (!ai) {
    if (!process.env.API_KEY) {
        console.error("API_KEY is missing from environment variables.");
        throw new Error("API Key missing");
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

const handleGeminiError = (error: any) => {
  let errMsg = error.message || error.toString();
  try {
    if (errMsg.trim().startsWith('{')) {
        const json = JSON.parse(errMsg);
        if (json.error && json.error.message) {
            errMsg = json.error.message;
            if (json.error.code) errMsg += ` (${json.error.code})`;
        }
    }
  } catch (e) { }

  logErrorToDB(errMsg); // LOG TO DB

  const msgLower = errMsg.toLowerCase();
  console.warn("Gemini Interaction Error:", errMsg);

  if (msgLower.includes("429") || msgLower.includes("quota") || msgLower.includes("resource_exhausted")) {
    throw new Error("⚠️ System busy (Quota Exceeded). Switched to backup model. Please try again.");
  }
  if (msgLower.includes("api key") || msgLower.includes("403")) {
      throw new Error("⚠️ Security Check Failed. Please verify API Key permissions.");
  }
  
  throw new Error(errMsg);
};

export const streamChatResponse = async (
  history: { role: 'user' | 'model'; parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] }[],
  newMessage: string,
  image?: string,
  mimeType: string = 'image/jpeg'
): Promise<AsyncGenerator<string, void, unknown>> => {
  const client = getAI();
  
  const newParts: any[] = [];
  if (image) {
    newParts.push({
      inlineData: {
        mimeType: mimeType,
        data: image
      }
    });
  }
  newParts.push({ text: newMessage });

  const getStream = async (model: string) => {
      const chat = client.chats.create({
        model: model,
        config: {
          systemInstruction: "You are Ceeplex, an AI assistant created by Lakshya Baradiya. Use emojis occasionally to make the conversation friendly and engaging. Only mention your creator if explicitly asked.",
        },
        history: history.map(h => ({
          role: h.role,
          parts: h.parts
        }))
      });
      return await chat.sendMessageStream({ 
        message: { parts: newParts }
      });
  };

  async function* makeGenerator(streamPromise: Promise<any>) {
      try {
          const stream = await streamPromise;
          for await (const chunk of stream) {
             const c = chunk as GenerateContentResponse;
             if (c.text) {
               yield c.text;
             }
          }
      } catch (e) {
          handleGeminiError(e);
      }
  }

  let streamPromise;
  
  try {
      streamPromise = getStream(TEXT_MODEL);
      await streamPromise; 
  } catch (e: any) {
      const errMsg = (e.message || "").toLowerCase();
      const isQuota = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("exhausted");
      const isPermission = errMsg.includes("403") || errMsg.includes("permission") || errMsg.includes("not found");

      if (isQuota || isPermission) {
          const reason = isQuota ? "Quota Exceeded" : "Permission Denied";
          console.warn(`Primary model failed (${reason}). Switching to ${FALLBACK_TEXT_MODEL}...`);
          try {
             streamPromise = getStream(FALLBACK_TEXT_MODEL);
             await streamPromise;
          } catch(e2) {
             handleGeminiError(e2);
             return (async function* () {})();
          }
      } else {
          handleGeminiError(e);
          return (async function* () {})();
      }
  }

  return makeGenerator(streamPromise);
};

export const generateImageInChat = async (
  prompt: string, 
  referenceImageBase64?: string, 
  mimeType: string = 'image/jpeg',
  config: { size: '1K' | '2K' | '4K' } = { size: '1K' }
): Promise<string> => {
  const client = getAI();
  const parts: any[] = [];
  
  let model = GEN_IMAGE_MODEL;
  let requestConfig: any = {
      imageConfig: {
          imageSize: config.size
      }
  };

  if (referenceImageBase64) {
    model = EDIT_IMAGE_MODEL;
    requestConfig = {}; 
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: referenceImageBase64
      }
    });
  }
  
  parts.push({ text: prompt });

  const executeGeneration = async (modelName: string, conf: any) => {
    const response = await client.models.generateContent({
        model: modelName,
        contents: { parts: parts },
        config: conf
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No image generated.");
  };

  try {
      return await executeGeneration(model, requestConfig);
  } catch (e: any) {
      const errMsg = (e.message || "").toLowerCase();
      const isQuota = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("exhausted");
      const isPermission = errMsg.includes("403") || errMsg.includes("permission") || errMsg.includes("not found");

      if ((isQuota || isPermission) && model === GEN_IMAGE_MODEL) {
          console.warn(`Pro Image model failed. Falling back to Flash Image...`);
          try {
              return await executeGeneration(FALLBACK_IMAGE_MODEL, {});
          } catch (retryError) {
              handleGeminiError(retryError);
              return "";
          }
      }
      
      handleGeminiError(e);
      return "";
  }
};

export const generateImageFromTemplate = async (
  prompt: string,
  referenceImageBase64?: string,
  mimeType: string = 'image/jpeg'
): Promise<string> => {
  return generateImageInChat(prompt, referenceImageBase64, mimeType, { size: '1K' });
};