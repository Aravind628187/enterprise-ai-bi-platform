import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Database, Trash2, Plus } from 'lucide-react'
import { chatApi, datasetsApi } from '../lib/api'
import ReactMarkdown from 'react-markdown'

interface Message { role: 'user' | 'assistant'; content: string }

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [datasetId, setDatasetId] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: datasets } = useQuery({ queryKey: ['datasets'], queryFn: () => datasetsApi.list().then(r => r.data) })
  const { data: sessions, refetch: refetchSessions } = useQuery({ queryKey: ['chat-sessions'], queryFn: () => chatApi.sessions().then(r => r.data) })

  const sendMut = useMutation({
    mutationFn: (msg: string) => chatApi.send({ message: msg, dataset_id: datasetId || undefined, session_id: sessionId }),
    onSuccess: (res) => {
      const data = res.data
      setSessionId(data.session_id)
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      refetchSessions()
    },
    onError: () => setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]),
  })

  const send = () => {
    if (!input.trim() || sendMut.isPending) return
    const msg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    sendMut.mutate(msg)
  }

  const loadSession = async (id: string) => {
    const res = await chatApi.session(id)
    setSessionId(id)
    setMessages(res.data.messages || [])
    setDatasetId(res.data.dataset_id || '')
  }

  const newChat = () => { setMessages([]); setSessionId(undefined); setInput('') }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 card p-3 flex flex-col gap-2 overflow-y-auto hidden lg:flex">
        <button onClick={newChat} className="btn-primary flex items-center gap-2 text-sm py-2"><Plus size={14} />New Chat</button>
        <hr className="border-slate-800" />
        {sessions?.map((s: any) => (
          <button key={s.id} onClick={() => loadSession(s.id)}
            className={`text-left text-xs px-3 py-2 rounded-lg truncate transition-colors ${s.id === sessionId ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800'}`}>
            {s.title || 'Chat session'}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col card overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-200 text-sm">AI Data Analyst</p>
            <p className="text-xs text-slate-500">Powered by GPT-4 / Gemini</p>
          </div>
          <select value={datasetId} onChange={e => setDatasetId(e.target.value)} className="input-field w-44 text-xs">
            <option value="">No dataset</option>
            {datasets?.filter((d: any) => d.status === 'ready').map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-600">
              <Bot size={48} className="mb-3 opacity-30" />
              <p className="font-medium">Start a conversation</p>
              <p className="text-sm mt-1">Ask about your data, request analysis, or explore insights</p>
              <div className="mt-4 grid grid-cols-1 gap-2 w-full max-w-sm">
                {['What are the key trends in this dataset?', 'Find outliers and anomalies', 'Summarize the data quality', 'What correlations exist?'].map(q => (
                  <button key={q} onClick={() => { setInput(q); send() }}
                    className="text-xs text-left p-2.5 bg-slate-800/50 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-300 transition-colors">
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          )}
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                  {msg.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
                </div>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown className="prose prose-invert prose-sm max-w-none">{msg.content}</ReactMarkdown>
                  ) : msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {sendMut.isPending && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"><Bot size={14} className="text-white" /></div>
              <div className="bg-slate-800 px-4 py-3 rounded-2xl">
                <div className="flex gap-1.5"><span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              className="input-field flex-1" placeholder="Ask about your data..." />
            <button onClick={send} disabled={!input.trim() || sendMut.isPending} className="btn-primary px-4">
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
