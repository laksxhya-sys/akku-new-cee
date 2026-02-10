import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Send, Image as ImageIcon, Trash2, StopCircle, RefreshCw, 
  Paperclip, X, Plus, MessageSquare, Menu, Wand2, MoreHorizontal, 
  ChevronLeft, WifiOff, Database, Headphones, Mic, MicOff,
  ArrowLeft, MoreVertical, Home, Grid, Shield, PlusCircle,
  Instagram, Phone, Mail, Info
} from 'lucide-react';
import { streamChatResponse, generateImageInChat } from '../services/geminiService';
import { compressImage } from '../services/imageUtils';
import { LiveService } from '../services/liveService';
import { ChatMessage, ChatSession, UserRole } from '../types';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, 
  serverTimestamp, doc, updateDoc, deleteDoc, setDoc, getDoc 
} from 'firebase/firestore';

const SuggestionCard = ({text, onClick}: {text: string, onClick: () => void}) => (
  <button onClick={onClick} className="p-4 bg-black/40 backdrop-blur-md hover:bg-black/60 border border-white/10 rounded-xl text-left text-sm text-slate-300 transition-colors w-full group hover:border-white/20">
    <span className="group-hover:text-white transition-colors">{text}</span>
  </button>
);

export const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{file: File, preview: string} | null>(null);
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  // Fix sidebar: Close by default on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  
  const [dbError, setDbError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  
  const [isImageMode, setIsImageMode] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0);
  const liveServiceRef = useRef<LiveService | null>(null);
  
  // New state for Creator Info Modal
  const [showCreatorInfo, setShowCreatorInfo] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mobileMessagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isGuest = user?.role === UserRole.GUEST;
  const getLocalDataKey = () => `ceeplex_chats_${user?.email || 'guest'}`;

  const loadLocalChats = (): ChatSession[] => {
    try {
        const saved = localStorage.getItem(getLocalDataKey());
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
  };

  const saveLocalChats = (updatedChats: ChatSession[]) => {
      try { localStorage.setItem(getLocalDataKey(), JSON.stringify(updatedChats)); } catch (e) {}
  };

  // Init/Load Chats
  useEffect(() => {
    if (!user) return;
    
    if (isGuest) {
        setIsOffline(true);
        const local = loadLocalChats();
        if (local.length > 0) {
            setChats(local);
        } else {
             const newChat = { id: 'guest-' + Date.now(), title: 'New Chat', messages: [], updatedAt: Date.now() };
             setChats([newChat]);
             setCurrentChatId(newChat.id);
             saveLocalChats([newChat]);
        }
        return;
    }
    
    setDbError(null);
    let unsubscribe: () => void;

    try {
      const q = query(
        collection(db, 'chats'), 
        where('userEmail', '==', user.email),
        orderBy('updatedAt', 'desc')
      );

      unsubscribe = onSnapshot(q, 
        (snapshot) => {
          setIsOffline(false);
          setDbError(null);
          const loadedChats = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            messages: [] 
          })) as ChatSession[];
          setChats(loadedChats);
        },
        (error) => {
          console.error("Chats snapshot error:", error);
          setIsOffline(true);
          const local = loadLocalChats();
          setChats(local.length > 0 ? local : [{ id: 'local-' + Date.now(), title: 'New Chat (Local)', messages: [], updatedAt: Date.now() }]);
          
          if (!currentChatId) {
             setCurrentChatId(local.length > 0 ? local[0].id : ('local-' + Date.now()));
          }

          if (error.code === 'permission-denied' || error.message.includes("Cloud Firestore API")) {
            setDbError(null); 
          } else {
            setDbError("Connection failed. Using local storage.");
          }
        }
      );
    } catch (e) {
      setIsOffline(true);
      const local = loadLocalChats();
      setChats(local);
    }

    return () => { if (unsubscribe) unsubscribe(); };
  }, [user]);

  // Load Messages
  useEffect(() => {
    if (!currentChatId) { setMessages([]); return; }

    if (isOffline || isGuest) {
        const chat = chats.find(c => c.id === currentChatId);
        if (chat) setMessages(chat.messages || []);
        else setMessages([]);
        return;
    }

    try {
      const q = query(collection(db, 'chats', currentChatId, 'messages'), orderBy('timestamp', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[]);
      }, (err) => {
          console.error("Messages snapshot error:", err);
      });
      return () => unsubscribe();
    } catch (e) { console.error("Message query error", e); }
  }, [currentChatId, isOffline, isGuest, chats]); 

  const scrollToBottom = () => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    if (mobileMessagesEndRef.current) mobileMessagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => {
    scrollToBottom();
    const timeout = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(timeout);
  }, [messages.length, isLoading]);

  const toggleLiveMode = async () => {
    if (isLiveMode) {
        if (liveServiceRef.current) {
            await liveServiceRef.current.disconnect();
            liveServiceRef.current = null;
        }
        setIsLiveMode(false);
        setIsLiveConnected(false);
    } else {
        setIsLiveMode(true);
        try {
            const service = new LiveService();
            liveServiceRef.current = service;
            await service.connect((vol) => setAudioVolume(vol));
            setIsLiveConnected(true);
        } catch (e) {
            console.error("Failed to start live mode", e);
            alert("Could not start Live Voice mode. Please check microphone permissions.");
            setIsLiveMode(false);
        }
    }
  };

  const updateLocalChat = (chatId: string, newMessages: ChatMessage[], title?: string) => {
      setChats(prev => {
          const chatExists = prev.some(c => c.id === chatId);
          let updatedChats;
          if (chatExists) {
              updatedChats = prev.map(c => c.id === chatId ? { ...c, messages: newMessages, title: title || c.title, updatedAt: Date.now() } : c);
          } else {
               const newChat: ChatSession = { id: chatId, title: title || 'New Chat', messages: newMessages, updatedAt: Date.now() };
               updatedChats = [newChat, ...prev];
          }
          saveLocalChats(updatedChats);
          return updatedChats;
      });
  };

  const createNewChat = async () => {
    const newId = (isOffline || isGuest ? 'local-' : '') + Date.now().toString();
    setMessages([]); 
    setInput(''); 
    setCurrentChatId(newId);
    
    if (isOffline || isGuest) {
        const newChat: ChatSession = { id: newId, title: 'New Chat', messages: [], updatedAt: Date.now() };
        const newChats = [newChat, ...chats];
        setChats(newChats);
        saveLocalChats(newChats);
    }
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (isOffline || isGuest) {
        const newChats = chats.filter(c => c.id !== chatId);
        setChats(newChats);
        saveLocalChats(newChats);
        if (currentChatId === chatId) { createNewChat(); }
        return;
    }
    if (window.confirm("Delete this chat?")) {
      try {
        await deleteDoc(doc(db, 'chats', chatId));
        if (currentChatId === chatId) createNewChat();
      } catch (err) { console.error("Error deleting chat", err); }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => { if (ev.target?.result) setSelectedImage({ file, preview: ev.target.result as string }); };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => { setSelectedImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; if (mobileFileInputRef.current) mobileFileInputRef.current.value = ''; };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;
    setIsLoading(true);
    const currentInput = input;
    const currentImage = selectedImage;
    const lowerInput = currentInput.toLowerCase();
    
    const isImageGeneration = isImageMode || (lowerInput.startsWith('generate image') || lowerInput.startsWith('create image') || lowerInput.startsWith('draw'));

    const tempUserMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: currentInput, image: currentImage?.preview, timestamp: Date.now() };
    const updatedMessages = [...messages, tempUserMsg];
    setMessages(updatedMessages);
    setInput(''); clearImage();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    let chatId = currentChatId;
    if (!chatId) {
        chatId = (isOffline || isGuest ? 'local-' : '') + Date.now().toString();
        setCurrentChatId(chatId);
    }

    if (isOffline || isGuest) {
        let title = undefined;
        const chat = chats.find(c => c.id === chatId);
        if (!chat || chat.title === 'New Chat') {
             title = currentInput.length > 30 ? currentInput.substring(0, 30) + '...' : currentInput;
        }
        updateLocalChat(chatId!, updatedMessages, title);
    }

    if (!isOffline && !isGuest && chatId) {
        try {
            const chatRef = doc(db, 'chats', chatId);
            const chatSnap = await getDoc(chatRef);
            
            if (!chatSnap.exists()) {
               await setDoc(chatRef, { 
                 userEmail: user?.email, 
                 title: currentInput.length > 30 ? currentInput.substring(0, 30) + '...' : currentInput, 
                 updatedAt: serverTimestamp() 
               });
            } else {
               const data = chatSnap.data();
               const updates: any = { updatedAt: serverTimestamp() };
               if (data.title === 'New Chat') {
                   updates.title = currentInput.length > 30 ? currentInput.substring(0, 30) + '...' : currentInput;
               }
               await updateDoc(chatRef, updates);
            }

            try {
                // Compress uploaded user image if large
                let userImageToSave = currentImage?.preview || null;
                if (userImageToSave && userImageToSave.length > 500000) {
                    userImageToSave = await compressImage(userImageToSave);
                }

                await addDoc(collection(db, 'chats', chatId, 'messages'), { role: 'user', text: currentInput, image: userImageToSave, timestamp: Date.now() });
            } catch(e) {
                console.warn("Failed to save user message (likely image size)", e);
                await addDoc(collection(db, 'chats', chatId, 'messages'), { role: 'user', text: currentInput + " [Image Upload Failed - Too Large]", timestamp: Date.now() });
            }
        } catch (error) { 
            console.error("Firestore sync error", error);
            setIsOffline(true); 
            updateLocalChat(chatId!, updatedMessages); 
        }
    }

    if (isImageGeneration) {
        try {
            const loadingMsgId = (Date.now() + 1).toString();
            const loadingMsg: ChatMessage = { id: loadingMsgId, role: 'model', text: '🎨 Generating...', timestamp: Date.now() };
            const messagesWithLoading = [...updatedMessages, loadingMsg];
            setMessages(messagesWithLoading);

            let base64 = currentImage ? currentImage.preview.split(',')[1] : undefined;
            const imageUrl = await generateImageInChat(currentInput, base64, currentImage?.file.type, { size: imageSize });
            
            const finalMessages = messagesWithLoading.filter(m => m.id !== loadingMsgId);
            const modelMsg: ChatMessage = { id: Date.now().toString(), role: 'model', text: `Here is the image for: "${currentInput}"`, image: imageUrl, timestamp: Date.now() };
            finalMessages.push(modelMsg);
            setMessages(finalMessages);

            if (isOffline || isGuest) updateLocalChat(chatId!, finalMessages);
            else {
                try {
                    // Compress generated image before saving
                    let imageUrlToSave = imageUrl;
                    if (imageUrl.length > 500000) {
                        imageUrlToSave = await compressImage(imageUrl);
                    }
                    
                    const msgToSave = { ...modelMsg, image: imageUrlToSave };
                    await addDoc(collection(db, 'chats', chatId!, 'messages'), msgToSave);

                    if (imageUrlToSave && !imageUrlToSave.includes("Error")) {
                        try {
                            await addDoc(collection(db, 'generated_images'), {
                                userEmail: user?.email,
                                prompt: currentInput,
                                imageUrl: imageUrlToSave, 
                                timestamp: Date.now()
                            });
                        } catch(e) { console.error("Failed to save generated image to gallery DB", e); }
                    }
                } catch(e) {
                    const fallbackMsg = { ...modelMsg, image: null, text: modelMsg.text + " [Image not saved to history - check Profile]" };
                    await addDoc(collection(db, 'chats', chatId!, 'messages'), fallbackMsg);
                }
            }
        } catch (error: any) {
            const errorMsg: ChatMessage = { id: Date.now().toString(), role: 'model', text: error.message || "Error generating image", timestamp: Date.now() };
            setMessages(prev => {
                const res = [...prev.filter(m => !m.text.includes('Generating')), errorMsg];
                if (isOffline || isGuest) updateLocalChat(chatId!, res);
                return res;
            });
        } finally { setIsLoading(false); }
        return;
    }

    const modelMsgId = (Date.now() + 1).toString();
    const modelMsgPlaceholder: ChatMessage = { id: modelMsgId, role: 'model', text: '', timestamp: Date.now() };
    let currentMessagesWithPlaceholder = [...updatedMessages, modelMsgPlaceholder];
    setMessages(currentMessagesWithPlaceholder);
    let fullResponse = "";

    try {
        const history = updatedMessages.slice(-10).map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        let base64 = currentImage ? currentImage.preview.split(',')[1] : undefined;
        const stream = await streamChatResponse(history, currentInput, base64, currentImage?.file.type);
        
        for await (const chunk of stream) {
            fullResponse += chunk;
            setMessages(prev => {
                const newMsg = [...prev];
                const msgIndex = newMsg.findIndex(m => m.id === modelMsgId);
                if (msgIndex !== -1) newMsg[msgIndex] = { ...newMsg[msgIndex], text: fullResponse };
                return newMsg;
            });
            scrollToBottom();
        }

        if (isOffline || isGuest) {
            updateLocalChat(chatId!, currentMessagesWithPlaceholder.map(m => m.id === modelMsgId ? { ...m, text: fullResponse } : m));
        } else {
            try { await addDoc(collection(db, 'chats', chatId!, 'messages'), { role: 'model', text: fullResponse, timestamp: Date.now() }); }
            catch(e) { updateLocalChat(chatId!, currentMessagesWithPlaceholder.map(m => m.id === modelMsgId ? { ...m, text: fullResponse } : m)); }
        }
    } catch (error: any) {
        setMessages(prev => {
            const newMsg = [...prev];
            const msgIndex = newMsg.findIndex(m => m.id === modelMsgId);
            if (msgIndex !== -1) newMsg[msgIndex] = { ...newMsg[msgIndex], text: error.message };
            if (isOffline || isGuest) updateLocalChat(chatId!, newMsg);
            return newMsg;
        });
    } finally { setIsLoading(false); }
  };

  return (
    <>
    {/* Creator Info Modal */}
    {showCreatorInfo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-fade-in" onClick={() => setShowCreatorInfo(false)}>
            <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 w-full max-w-sm relative shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowCreatorInfo(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
                <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">Trainer & Creator</p>
                    <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                        <img src="https://iili.io/fpcnLLQ.png" className="w-16 h-16 object-contain drop-shadow-lg" alt="Logo"/>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 tracking-wide">Lakshya Baradiya</h3>
                    
                    <div className="space-y-3 mt-6 text-sm text-slate-300">
                      <a href="https://instagram.com/__laksxhya__" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 hover:text-white transition-colors p-2 bg-white/5 rounded-lg border border-white/5">
                          <Instagram size={18} /> @__laksxhya__
                      </a>
                      <a href="https://instagram.com/ceeplex" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 hover:text-white transition-colors p-2 bg-white/5 rounded-lg border border-white/5">
                          <Instagram size={18} /> @ceeplex
                      </a>
                      <div className="flex items-center justify-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5">
                          <Phone size={18} /> +91 626871641
                      </div>
                       <div className="flex items-center justify-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5 text-xs">
                          <Mail size={18} /> ceeplex1@gmail.com
                      </div>
                    </div>
                </div>
            </div>
        </div>
    )}

    {/* DESKTOP VIEW */}
    <div className="hidden md:flex h-[calc(100vh-85px)] mt-[-20px] md:mt-0 overflow-hidden bg-transparent text-slate-100 relative">
      
      {/* Live Mode Overlay */}
      {isLiveMode && (
          <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center animate-fade-in">
              <button onClick={toggleLiveMode} className="absolute top-6 right-6 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all"><X size={24} /></button>
              <div className="flex flex-col items-center gap-8 w-full max-w-md px-6">
                  
                  {/* Logo Container */}
                  <div className="w-32 h-32 flex items-center justify-center animate-pulse-slow">
                     <img src="https://iili.io/fpcnLLQ.png" alt="Ceeplex" className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
                  </div>

                  <div className="text-center space-y-2">
                     <h2 className="text-2xl font-bold text-white tracking-wide font-display">Ceeplex Live</h2>
                     <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">{isLiveConnected ? "Listening" : "Connecting..."}</p>
                  </div>

                  <div className="relative flex items-center justify-center h-64 w-full">
                      {isLiveConnected ? (
                          <><div className="w-32 h-32 rounded-full bg-white transition-all duration-75 ease-out shadow-[0_0_50px_rgba(255,255,255,0.2)]" style={{ transform: `scale(${1 + Math.max(0, audioVolume * 0.4)})` }} />{audioVolume > 0.1 && (<div className="absolute w-40 h-40 rounded-full border border-white/20 animate-ping opacity-50" style={{ animationDuration: '1.5s' }} />)}{audioVolume > 0.3 && (<div className="absolute w-48 h-48 rounded-full border border-white/10 animate-ping opacity-30" style={{ animationDuration: '2s', animationDelay: '0.2s' }} />)}</>
                      ) : (<div className="w-16 h-16 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>)}
                  </div>
                  <div className="text-slate-500 text-xs text-center max-w-xs space-y-1">
                      <p>Speak naturally. Ceeplex is listening.</p>
                      <p className="text-[10px] opacity-70">Trainer: Lakshya Baradiya</p>
                  </div>
                  <div className="flex gap-4"><button onClick={toggleLiveMode} className="p-4 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"><MicOff size={24} /></button></div>
              </div>
          </div>
      )}

      {/* Sidebar - Heavy Glass Effect */}
      <div className={`fixed md:relative inset-y-0 left-0 z-40 bg-black/60 backdrop-blur-3xl border-r border-white/10 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[280px] translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:border-none md:overflow-hidden'}`} style={{top: '0px', paddingTop: '80px'}}>
        <div className="p-4 space-y-4">
            <button onClick={createNewChat} className="w-full flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all text-sm font-medium shadow-sm tracking-wide uppercase text-xs"><Plus size={16} /> New Chat</button>
            {(isGuest || isOffline) && (<div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-black/60 to-black/40 border border-orange-900/30 p-4"><div className="flex items-start gap-3 relative z-10">{isGuest ? <Database size={16} className="text-orange-400 mt-1" /> : <WifiOff size={16} className="text-orange-400 mt-1" />}<div><h4 className="text-sm font-bold text-orange-200">{isGuest ? 'Guest Mode' : 'Local Mode'}</h4><p className="text-[10px] text-orange-400/80 mt-1 leading-tight">{isGuest ? 'Chats saved to device.' : 'Database unavailable. Using local storage.'}</p></div></div></div>)}
            {dbError && !isGuest && <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-300">{dbError}</div>}
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2 mt-2">Recent</div>
          <div className="space-y-1">
            {chats.map(chat => (
              <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); if (window.innerWidth < 768) setIsSidebarOpen(false); }} className={`group relative flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors text-sm ${currentChatId === chat.id ? 'bg-white/10 text-white border border-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
                <span className="truncate flex-1 pr-6">{chat.title || 'New Chat'}</span>
                <button onClick={(e) => deleteChat(e, chat.id)} className={`absolute right-2 p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-all ${currentChatId === chat.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Area - Transparent/Glass with Rectangular Rounded Box */}
      <div className="flex-1 flex flex-col relative w-full h-full min-w-0 p-2 md:p-4">
        {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="absolute top-6 left-6 z-50 p-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 md:hidden"><Menu size={20} /></button>}

        <div className="bg-black/40 backdrop-blur-2xl w-full h-full rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col relative">
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth pb-48">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-0 animate-fade-in" style={{animationFillMode: 'forwards'}}>
                        <div className="mb-8 relative flex items-center justify-center">
                             <div className="absolute inset-0 bg-white/5 blur-[80px] rounded-full w-40 h-40"></div>
                             <div className="relative z-10 w-28 h-28 flex items-center justify-center">
                                <img src="https://iili.io/fpcnLLQ.png" alt="Ceeplex" className="w-24 h-24 object-contain drop-shadow-2xl" />
                             </div>
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight font-display">Ceeplex Intelligence</h2>
                        <p className="text-slate-300 mb-12 text-sm shadow-black drop-shadow-sm">How can I help you today?</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl text-left">
                            <SuggestionCard text="Translate 'Hello' to..." onClick={() => setInput("Translate 'Hello' to Spanish, French and Japanese")} />
                            <SuggestionCard text="How to code a navbar" onClick={() => setInput("Show me how to code a responsive navbar in React and Tailwind")} />
                            <SuggestionCard text="Generate futuristic art" onClick={() => { setIsImageMode(true); setInput("Generate image of a futuristic neon city"); }} />
                        </div>
                        
                        <div className="mt-12 text-[10px] text-slate-500 uppercase tracking-widest">
                             Trainer & Creator: Lakshya Baradiya
                        </div>
                    </div>
                )}
                
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[90%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {msg.role === 'model' && <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1"><img src="https://iili.io/fpcnLLQ.png" className="w-6 h-6 object-contain" /></div>}
                            <div className={`p-4 text-[15px] leading-relaxed shadow-lg overflow-hidden ${msg.role === 'user' ? 'bg-white text-black rounded-2xl rounded-tr-sm font-medium' : 'bg-black/60 backdrop-blur-xl text-slate-100 border border-white/10 rounded-2xl rounded-tl-sm'}`}>
                                {msg.image && <div className="mb-3 rounded-lg overflow-hidden bg-black/20"><img src={msg.image} className="max-w-full h-auto" onLoad={scrollToBottom} /></div>}
                                <div className="whitespace-pre-wrap break-words min-w-0">{msg.text}</div>
                            </div>
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                    <div className="flex w-full justify-start">
                        <div className="flex gap-3 max-w-[75%]">
                            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1"><img src="https://iili.io/fpcnLLQ.png" className="w-6 h-6 object-contain" /></div>
                            <div className="bg-black/60 backdrop-blur-xl p-4 rounded-2xl rounded-tl-sm border border-white/10 flex items-center gap-2">
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-75"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Bar */}
            <div className="absolute bottom-0 left-0 right-0 z-20 p-4 md:p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-20">
                {selectedImage && (<div className="absolute top-[-50px] left-6 p-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl flex items-center gap-3 animate-slide-up shadow-xl z-30"><img src={selectedImage.preview} alt="Preview" className="w-12 h-12 object-cover rounded-lg" /><button onClick={clearImage} className="bg-red-500/20 text-red-400 rounded-full p-1 hover:bg-red-500 hover:text-white transition-colors"><X size={14} /></button></div>)}
                <div className="max-w-3xl mx-auto bg-black/70 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-2 pl-4 pr-2 flex items-center shadow-2xl relative">
                    <button onClick={() => fileInputRef.current?.click()} className="text-slate-400 hover:text-white p-2 hover:bg-white/5 rounded-full transition-colors"><Paperclip size={20} /></button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                    <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={isImageMode ? "Describe the image you want to generate..." : "Ask Ceeplex anything..."} className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-slate-400 resize-none py-3 px-3 max-h-[120px] overflow-y-auto leading-relaxed scrollbar-hide" rows={1} style={{minHeight: '44px'}} />
                    <div className="flex items-center gap-1">
                        <button onClick={() => setIsImageMode(!isImageMode)} className={`p-2 rounded-full transition-all duration-300 ${isImageMode ? 'text-white bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Toggle Image Generation Mode"><ImageIcon size={20} /></button>
                        <button onClick={toggleLiveMode} className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors" title="Live Voice Chat"><Headphones size={20} /></button>
                        <button onClick={handleSend} disabled={isLoading || (!input.trim() && !selectedImage)} className={`p-3 rounded-full transition-all duration-200 flex items-center justify-center ${(input.trim() || selectedImage) && !isLoading ? 'bg-white text-black hover:bg-slate-200 shadow-lg shadow-white/10' : 'bg-white/5 text-slate-500 cursor-not-allowed'}`}>{isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}</button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>

    {/* MOBILE VIEW */}
    <div className="md:hidden fixed inset-0 z-[60] bg-transparent flex flex-col font-sans text-slate-100 pointer-events-none">
        
        {/* Mobile Header (Clickable) */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5 px-4 h-16 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2">
                {/* Left: Menu Button (Sidebar History) */}
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <Menu className="text-slate-400" size={24} />
                </button>

                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full p-[1px]">
                            <div className="w-full h-full flex items-center justify-center">
                                <img src="https://iili.io/fpcnLLQ.png" alt="Bot" className="w-8 h-8 object-contain" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold tracking-tight text-white font-display uppercase">Ceeplex</h1>
                    </div>
                </div>
            </div>
            
            {/* Right: 3 Dots (Creator Info) */}
            <div className="flex gap-1">
                <button 
                  onClick={() => setShowCreatorInfo(true)} 
                  className="p-3 hover:bg-white/10 rounded-full transition-colors relative z-50 active:bg-white/20 touch-manipulation"
                  aria-label="More Info"
                >
                    <MoreVertical className="text-slate-400" size={24} />
                </button>
            </div>
        </header>

        {/* Mobile Sidebar (History) Overlay */}
        {isSidebarOpen && (
            <div className="fixed inset-0 z-[70] flex pointer-events-auto">
                <div className="w-[80%] max-w-[300px] h-full bg-black/90 backdrop-blur-2xl border-r border-white/10 p-4 flex flex-col shadow-2xl animate-slide-right">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="font-bold text-lg uppercase tracking-wider">Chat History</h2>
                        <button onClick={() => setIsSidebarOpen(false)}><X className="text-slate-400" size={24}/></button>
                    </div>
                    <button onClick={createNewChat} className="w-full flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all text-sm font-medium shadow-sm mb-4 uppercase text-xs tracking-wide">
                        <Plus size={16} /> New Chat
                    </button>
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {chats.map(chat => (
                        <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); setIsSidebarOpen(false); }} className={`flex items-center justify-between p-3 rounded-lg ${currentChatId === chat.id ? 'bg-white/10 text-white border border-white/10' : 'text-slate-400'}`}>
                            <span className="truncate text-sm">{chat.title || 'New Chat'}</span>
                            <button onClick={(e) => deleteChat(e, chat.id)} className="p-1"><Trash2 size={14}/></button>
                        </div>
                        ))}
                    </div>
                </div>
                <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
            </div>
        )}

        {/* Mobile Messages Area (Clickable) */}
        <main className="flex-1 overflow-y-auto pt-20 pb-[160px] px-4 flex flex-col gap-6 scrollbar-none pointer-events-auto bg-transparent">
            
            {/* Live Mode Overlay for Mobile */}
            {isLiveMode && (
                <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center animate-fade-in pointer-events-auto">
                    <button onClick={toggleLiveMode} className="absolute top-6 right-6 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all"><X size={24} /></button>
                    <div className="flex flex-col items-center gap-8 w-full max-w-md px-6">
                        <div className="w-32 h-32 flex items-center justify-center animate-pulse-slow">
                           <img src="https://iili.io/fpcnLLQ.png" alt="Ceeplex" className="w-24 h-24 object-contain" />
                        </div>
                        <div className="text-center space-y-2">
                           <h2 className="text-2xl font-bold text-white tracking-wide font-display">Ceeplex Live</h2>
                           <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">{isLiveConnected ? "Listening" : "Connecting..."}</p>
                        </div>
                        <div className="relative flex items-center justify-center h-64 w-full">
                            {isLiveConnected ? (
                                <><div className="w-32 h-32 rounded-full bg-white transition-all duration-75 ease-out shadow-[0_0_50px_rgba(255,255,255,0.2)]" style={{ transform: `scale(${1 + Math.max(0, audioVolume * 0.4)})` }} />{audioVolume > 0.1 && (<div className="absolute w-40 h-40 rounded-full border border-white/20 animate-ping opacity-50" style={{ animationDuration: '1.5s' }} />)}{audioVolume > 0.3 && (<div className="absolute w-48 h-48 rounded-full border border-white/10 animate-ping opacity-30" style={{ animationDuration: '2s', animationDelay: '0.2s' }} />)}</>
                            ) : (<div className="w-16 h-16 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>)}
                        </div>
                        <div className="text-slate-500 text-xs text-center max-w-xs space-y-1">
                             <p>Speak naturally. Ceeplex is listening.</p>
                             <p className="text-[10px] opacity-70">Trainer: Lakshya Baradiya</p>
                        </div>
                        <div className="flex gap-4"><button onClick={toggleLiveMode} className="p-4 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"><MicOff size={24} /></button></div>
                    </div>
                </div>
            )}

            <div className="flex justify-center">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] bg-black/60 backdrop-blur-xl px-3 py-1 rounded-full border border-white/5">Today</span>
            </div>

            {messages.length === 0 && (
                 <div className="flex flex-col items-center justify-center text-center mt-20">
                    <div className="w-24 h-24 flex items-center justify-center mb-6">
                        <img src="https://iili.io/fpcnLLQ.png" alt="Bot" className="w-16 h-16 object-contain drop-shadow-lg" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2 shadow-black drop-shadow-md font-display">Welcome to Ceeplex</h2>
                    <p className="text-sm text-slate-300 max-w-xs mb-8 shadow-black drop-shadow-sm">
                        Your personal AI creative assistant. Start by typing a message below.
                    </p>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                        Trainer: Lakshya Baradiya
                    </div>
                </div>
            )}

            {messages.map((msg) => (
                <div key={msg.id} className={`flex items-start gap-3 max-w-[90%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : ''}`}>
                    {msg.role === 'model' ? (
                        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                             <img src="https://iili.io/fpcnLLQ.png" alt="Bot" className="w-6 h-6 object-contain" />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 bg-slate-800 flex items-center justify-center">
                             <span className="text-xs font-bold text-white">{user?.name?.charAt(0) || 'U'}</span>
                        </div>
                    )}
                    
                    <div className={`rounded-2xl p-4 shadow-xl ${
                        msg.role === 'user' 
                        ? 'bg-white text-black backdrop-blur-md rounded-tr-none font-medium' 
                        : 'bg-black/60 backdrop-blur-xl border border-white/10 rounded-tl-none'
                    }`}>
                        {msg.image && (
                           <div className="mb-3 rounded-lg overflow-hidden bg-black/20">
                             <img src={msg.image} className="max-w-full h-auto" onLoad={scrollToBottom} />
                           </div>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <span className={`text-[10px] mt-2 block opacity-60 ${msg.role === 'user' ? 'text-right' : ''}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    </div>
                </div>
            ))}
            
            {isLoading && (
               <div className="flex items-start gap-3 max-w-[90%]">
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <img src="https://iili.io/fpcnLLQ.png" alt="Bot" className="w-6 h-6 object-contain" />
                    </div>
                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl rounded-tl-none p-4 shadow-xl flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce delay-100"></div>
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce delay-200"></div>
                    </div>
               </div>
            )}
            <div ref={mobileMessagesEndRef} className="h-4" />
        </main>

        <div className="fixed bottom-[90px] left-0 right-0 z-[110] pointer-events-auto">
            <div className="px-4">
                {selectedImage && (<div className="mb-2 p-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl flex items-center gap-3 w-fit"><img src={selectedImage.preview} alt="Preview" className="w-12 h-12 object-cover rounded-lg" /><button onClick={clearImage} className="bg-red-500/20 text-red-400 rounded-full p-1"><X size={14} /></button></div>)}
                <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-[2rem] p-1.5 flex items-center gap-1 shadow-2xl">
                    <button onClick={() => mobileFileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                        <PlusCircle size={24} />
                    </button>
                    <input type="file" ref={mobileFileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                    <button onClick={() => setIsImageMode(!isImageMode)} className={`w-10 h-10 flex items-center justify-center transition-colors ${isImageMode ? 'text-white' : 'text-slate-400 hover:text-white'}`}>
                        <ImageIcon size={24} />
                    </button>
                    
                    <button onClick={toggleLiveMode} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                        <Headphones size={24} />
                    </button>

                    <input 
                       value={input} 
                       onChange={(e) => setInput(e.target.value)} 
                       onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                       className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-2 text-slate-100 placeholder-slate-400" 
                       placeholder="Message..." 
                       type="text"
                    />
                    <button onClick={handleSend} disabled={isLoading || (!input.trim() && !selectedImage)} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50">
                        {isLoading ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} className="ml-0.5" />}
                    </button>
                </div>
            </div>
        </div>
    </div>
    </>
  );
};