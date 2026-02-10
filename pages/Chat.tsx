import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Image as ImageIcon, Trash2, StopCircle, RefreshCw, 
  Paperclip, X, Plus, MessageSquare, Menu, Wand2, MoreHorizontal, 
  ChevronLeft, WifiOff, Database, Headphones, Mic, MicOff, MoreVertical,
  Instagram, Phone, Mail
} from 'lucide-react';
import { streamChatResponse, generateImageInChat } from '../services/geminiService';
import { LiveService } from '../services/liveService';
import { ChatMessage, ChatSession, UserRole } from '../types';
import firebase, { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

const SuggestionCard = ({text, onClick}: {text: string, onClick: () => void}) => (
  <button onClick={onClick} className="p-4 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-left text-sm text-slate-300 transition-colors w-full group">
    <span className="group-hover:text-white transition-colors">{text}</span>
  </button>
);

export const Chat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{file: File, preview: string} | null>(null);
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  // Sidebar State: Closed by default on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  
  const [dbError, setDbError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  
  const [isImageMode, setIsImageMode] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0);
  const liveServiceRef = useRef<LiveService | null>(null);
  
  const [showCreatorInfo, setShowCreatorInfo] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isGuest = user?.role === UserRole.GUEST;
  const getLocalDataKey = () => `ceeplex_chats_${user?.email || 'guest'}`;

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      const q = db.collection('chats')
        .where('userEmail', '==', user.email)
        .orderBy('updatedAt', 'desc');

      unsubscribe = q.onSnapshot(
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
      const q = db.collection('chats').doc(currentChatId).collection('messages').orderBy('timestamp', 'asc');
      const unsubscribe = q.onSnapshot((snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[]);
      }, () => setIsOffline(true));
      return () => unsubscribe();
    } catch (e) { setIsOffline(true); }
  }, [currentChatId, isOffline, isGuest, chats]); 

  const scrollToBottom = () => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
          const chat = updatedChats.find(c => c.id === chatId);
          const others = updatedChats.filter(c => c.id !== chatId);
          const result = chat ? [chat, ...others] : others;
          saveLocalChats(result);
          return result;
      });
  };

  const createNewChat = async () => {
    const newId = (isOffline || isGuest ? 'local-' : '') + Date.now();
    setMessages([]); setInput(''); setCurrentChatId(newId);
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
        if (currentChatId === chatId) { setCurrentChatId(null); setMessages([]); }
        return;
    }
    if (window.confirm("Delete this chat?")) {
      try {
        await db.collection('chats').doc(chatId).delete();
        if (currentChatId === chatId) createNewChat();
      } catch (err) { /* ignore */ }
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

  const clearImage = () => { setSelectedImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

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
        chatId = (isOffline || isGuest ? 'local-' : '') + Date.now();
        setCurrentChatId(chatId);
        
        // Initial Local State Update for smoothness
        const title = currentInput.length > 30 ? currentInput.substring(0, 30) + '...' : currentInput;
        const newChat: ChatSession = { id: chatId, title, messages: [tempUserMsg], updatedAt: Date.now() };
        if (isOffline || isGuest) {
             setChats(prev => [newChat, ...prev]);
             saveLocalChats([newChat, ...chats]);
        }
    } else if (isOffline || isGuest) updateLocalChat(chatId, updatedMessages);

    // DB SYNC: Create Chat & Message
    if (!isOffline && !isGuest && chatId) {
        try {
            const chatExists = chats.find(c => c.id === chatId);
            
            // IMPORTANT: Use setDoc with the specific chatId to ensure URL and DB match
            if (!chatExists) {
               await db.collection('chats').doc(chatId).set({ 
                 userEmail: user?.email, 
                 title: currentInput.substring(0,30), 
                 updatedAt: firebase.firestore.FieldValue.serverTimestamp() 
               });
            } else {
               await db.collection('chats').doc(chatId).update({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            }

            await db.collection('chats').doc(chatId).collection('messages').add({ role: 'user', text: currentInput, image: currentImage?.preview || null, timestamp: Date.now() });
        } catch (error) { setIsOffline(true); updateLocalChat(chatId, updatedMessages); }
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
                await db.collection('chats').doc(chatId!).collection('messages').add(modelMsg);
                // Also save to global generated_images collection for profile
                if (imageUrl.startsWith('data:')) {
                    await db.collection('generated_images').add({
                        userEmail: user?.email,
                        prompt: currentInput,
                        imageUrl: imageUrl, 
                        timestamp: Date.now()
                    });
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
            try { await db.collection('chats').doc(chatId!).collection('messages').add({ role: 'model', text: fullResponse, timestamp: Date.now() }); }
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
    <div className="flex flex-col md:flex-row h-[calc(100vh-85px)] mt-[-20px] md:mt-0 overflow-hidden bg-transparent text-slate-100 relative">
      
      {/* Live Mode Overlay */}
      {isLiveMode && (
          <div className="absolute inset-0 z-[150] bg-[#020617] flex flex-col items-center justify-center animate-fade-in">
              <button onClick={toggleLiveMode} className="absolute top-6 right-6 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all"><X size={24} /></button>
              <div className="flex flex-col items-center gap-12 w-full max-w-md px-6">
                  <div className="text-center space-y-2">
                     <h2 className="text-2xl font-bold text-white tracking-wide">Ceeplex Live</h2>
                     <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">{isLiveConnected ? "Listening" : "Connecting..."}</p>
                  </div>
                  <div className="relative flex items-center justify-center h-64 w-full">
                      {isLiveConnected ? (
                          <><div className="w-32 h-32 rounded-full bg-white transition-all duration-75 ease-out shadow-[0_0_50px_rgba(255,255,255,0.2)]" style={{ transform: `scale(${1 + Math.max(0, audioVolume * 0.4)})` }} />{audioVolume > 0.1 && (<div className="absolute w-40 h-40 rounded-full border border-white/20 animate-ping opacity-50" style={{ animationDuration: '1.5s' }} />)}{audioVolume > 0.3 && (<div className="absolute w-48 h-48 rounded-full border border-white/10 animate-ping opacity-30" style={{ animationDuration: '2s', animationDelay: '0.2s' }} />)}</>
                      ) : (<div className="w-16 h-16 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>)}
                  </div>
                  <div className="text-slate-500 text-xs text-center max-w-xs">Speak naturally. Ceeplex is listening.<br/> Created by Lakshya.</div>
                  <div className="flex gap-4"><button onClick={toggleLiveMode} className="p-4 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"><MicOff size={24} /></button></div>
              </div>
          </div>
      )}

      {/* Creator Info Modal */}
      {showCreatorInfo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-fade-in" onClick={() => setShowCreatorInfo(false)}>
            <div className="bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 w-full max-w-sm relative shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
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

      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-black/60 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-4 z-[60]">
         <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-300 hover:text-white">
                <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
               <img src="https://iili.io/fpcnLLQ.png" alt="Ceeplex" className="w-6 h-6 object-contain" />
               <span className="font-display font-bold text-white tracking-wider">Ceeplex</span>
            </div>
         </div>
         <button onClick={() => setShowCreatorInfo(true)} className="p-2 -mr-2 text-slate-300 hover:text-white">
            <MoreVertical size={24} />
         </button>
      </div>

      {/* SIDEBAR BACKDROP */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/80 z-[70] backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <div className={`fixed md:relative inset-y-0 left-0 z-[80] md:z-auto bg-black/60 backdrop-blur-xl border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} w-[280px] md:w-[280px] md:translate-x-0 md:flex`} style={{ paddingTop: '0px' }}>
        
        {/* Mobile Sidebar Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5">
             <span className="font-bold text-slate-200">History</span>
             <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400"><X size={20}/></button>
        </div>

        <div className="p-4 space-y-4 pt-4 md:pt-20">
            <button onClick={createNewChat} className="w-full flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all text-sm font-medium shadow-sm"><Plus size={18} className="text-blue-400" /> New Chat</button>
            {(isGuest || isOffline) && (<div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1e1b18] to-[#120f0d] border border-orange-900/30 p-4"><div className="flex items-start gap-3 relative z-10">{isGuest ? <Database size={16} className="text-orange-400 mt-1" /> : <WifiOff size={16} className="text-orange-400 mt-1" />}<div><h4 className="text-sm font-bold text-orange-200">{isGuest ? 'Guest Mode' : 'Local Mode'}</h4><p className="text-[10px] text-orange-400/80 mt-1 leading-tight">{isGuest ? 'Chats saved to device.' : 'Database unavailable. Using local storage.'}</p></div></div></div>)}
            {dbError && !isGuest && <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-300">{dbError}</div>}
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2 mt-2">Recent</div>
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

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative w-full h-full min-w-0 p-2 md:p-4 pt-16 md:pt-4">
        {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="absolute top-6 left-6 z-50 p-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 hidden md:block"><Menu size={20} /></button>}

        <div className="bg-black/60 backdrop-blur-xl w-full h-full rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col relative">
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth pb-36">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-0 animate-fade-in" style={{animationFillMode: 'forwards'}}>
                        <div className="mb-6 relative">
                             <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full"></div>
                             <img src="https://iili.io/fpcnLLQ.png" alt="Ceeplex" className="w-16 h-16 object-contain relative z-10 drop-shadow-lg" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-200 mb-2">Ceeplex Intelligence Engine</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-12 w-full max-w-xl text-left">
                            <SuggestionCard text="Translate 'Hello' to..." onClick={() => setInput("Translate 'Hello' to Spanish, French and Japanese")} />
                            <SuggestionCard text="How to code a navbar" onClick={() => setInput("Show me how to code a responsive navbar in React and Tailwind")} />
                            <SuggestionCard text="Generate futuristic art" onClick={() => { setIsImageMode(true); setInput("Generate image of a futuristic neon city"); }} />
                        </div>
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[90%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {msg.role === 'model' && (
                                <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center border border-white/10 flex-shrink-0 mt-1">
                                    <img src="https://iili.io/fpcnLLQ.png" className="w-5 h-5 object-contain" />
                                </div>
                            )}
                            <div className={`p-4 text-[15px] leading-relaxed shadow-lg overflow-hidden ${msg.role === 'user' ? 'bg-white text-black rounded-2xl rounded-tr-sm font-medium' : 'bg-black/40 backdrop-blur-md text-slate-200 border border-white/10 rounded-2xl rounded-tl-sm'}`}>
                                {msg.image && <div className="mb-3 rounded-lg overflow-hidden bg-black/20"><img src={msg.image} className="max-w-full h-auto" onLoad={scrollToBottom} /></div>}
                                <div className="whitespace-pre-wrap break-words min-w-0">{msg.text}</div>
                            </div>
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                    <div className="flex w-full justify-start">
                        <div className="flex gap-3 max-w-[75%]">
                            <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center border border-white/10 flex-shrink-0 mt-1">
                                <img src="https://iili.io/fpcnLLQ.png" className="w-5 h-5 object-contain" />
                            </div>
                            <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl rounded-tl-sm border border-white/10 flex items-center gap-2">
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-100"></div>
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-200"></div>
                            </div>
                        </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-20 p-4 md:p-6 bg-gradient-to-t from-black via-black/80 to-transparent pt-20">
                {selectedImage && (<div className="absolute top-[-70px] left-6 p-2 bg-black/80 border border-white/10 rounded-xl flex items-center gap-3 animate-slide-up shadow-xl z-30"><img src={selectedImage.preview} alt="Preview" className="w-12 h-12 object-cover rounded-lg" /><button onClick={clearImage} className="bg-red-500/20 text-red-400 rounded-full p-1 hover:bg-red-500 hover:text-white transition-colors"><X size={14} /></button></div>)}
                <div className="max-w-3xl mx-auto bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-2 pl-4 pr-2 flex items-center shadow-2xl relative">
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
  );
};