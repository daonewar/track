'use client'

import { useState, useEffect, useRef } from 'react'
import io from 'socket.io-client'

const GUN_SHOT_URL = '/start.mp3'

export default function Home() {
  const [socket, setSocket] = useState(null)
  const [view, setView] = useState('landing')
  const [roomCode, setRoomCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [roomState, setRoomState] = useState(null)
  const [displayTime, setDisplayTime] = useState(0)
  const [activeModal, setActiveModal] = useState(null)
  const [currentStatus, setCurrentStatus] = useState('READY')
  const gunAudio = useRef(null)

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://trackthing.onrender.com'
    const newSocket = io(backendUrl)
    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [])

  useEffect(() => {
    gunAudio.current = new Audio(GUN_SHOT_URL)
    gunAudio.current.preload = 'auto'
    gunAudio.current.load()

    let interval
    if (roomState?.status === 'RUNNING') {
      interval = setInterval(() => {
        setDisplayTime(Date.now() - roomState.startTime)
      }, 10)
    } else if (roomState?.status === 'IDLE') {
      setDisplayTime(0)
    } else if (roomState?.status === 'STOPPED') {
      setDisplayTime(roomState.endTime - roomState.startTime)
    } else if (roomState?.status === 'PAUSED') {
      setDisplayTime(roomState.pauseTime - roomState.startTime)
    }
    return () => clearInterval(interval)
  }, [roomState])

  useEffect(() => {
    if (!socket) return

    socket.on('room-update', ({ action, room }) => {
      setRoomState(room)
      updateStatusLabel(action, room.status)
      handleSideEffects(action)
    })

    return () => {
      socket.off('room-update')
    }
  }, [socket])

  const updateStatusLabel = (action, status) => {
    if (action === 'MARKS') setCurrentStatus('ON YOUR MARKS')
    else if (action === 'SET') setCurrentStatus('SET')
    else if (action === 'START') setCurrentStatus('RUNNING')
    else if (action === 'FALSE_START') setCurrentStatus('FALSE START')
    else if (action === 'CONCLUDE') setCurrentStatus('CONCLUDED')
    else if (action === 'RESET') setCurrentStatus('READY')
    else if (status === 'IDLE') setCurrentStatus('READY')
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else if (document.exitFullscreen) {
      document.exitFullscreen()
    }
  }

  const handleSideEffects = (action) => {
    const synth = window.speechSynthesis
    if (action === 'MARKS') synth.speak(new SpeechSynthesisUtterance('Runners, on your marks'))
    else if (action === 'SET') synth.speak(new SpeechSynthesisUtterance('Set'))
    else if (action === 'START' || action === 'FALSE_START') {
      if (gunAudio.current) {
        gunAudio.current.currentTime = 0
        gunAudio.current.play()
      }
    }
  }

  const createRoom = () => {
    if (!socket) return
    socket.emit('create-room', accessCode, (res) => {
      if (res.success) {
        setRoomCode(res.roomCode)
        setRoomState(res.state)
        setView('host')
        setActiveModal(null)
      } else {
        alert(res.message)
      }
    })
  }

  const joinRoom = () => {
    if (!socket) return
    socket.emit('join-room', inputCode.toUpperCase(), (res) => {
      if (res.success) {
        setRoomCode(inputCode.toUpperCase())
        setRoomState(res.state)
        setView('viewer')
        setActiveModal(null)
      } else {
        alert(res.message)
      }
    })
  }

  const sendAction = (action, payload = null) => {
    if (!socket) return
    socket.emit('timer-action', { roomCode, action, payload })
  }

  const formatTime = (ms) => {
    const absMs = Math.max(0, ms)
    const mm = Math.floor(absMs / 60000)
    const ss = Math.floor((absMs % 60000) / 1000)
    const msms = Math.floor((absMs % 1000) / 10)
    return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}.${msms.toString().padStart(2, '0')}`
  }

  if (view === 'landing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-sans p-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-600 to-transparent shadow-[0_0_20px_#ea580c]"></div>
        
        <h1 className="text-7xl md:text-9xl font-black mb-16 tracking-tighter">
          <span className="text-orange-600 drop-shadow-[0_0_15px_rgba(234,88,12,0.6)]">TRACK</span>
          <span className="text-white">THING</span>
        </h1>
        
        <div className="flex flex-col md:flex-row gap-8 w-full max-w-2xl relative z-10">
          <button 
            className="flex-1 bg-zinc-900 border-2 border-zinc-800 hover:border-orange-600 text-white font-black py-8 rounded-3xl text-3xl uppercase tracking-wider transition-all duration-500 shadow-2xl hover:shadow-orange-600/20 active:scale-95"
            onClick={() => setActiveModal('host')}
          >
            Host Meet
          </button>
          <button 
            className="flex-1 bg-white hover:bg-zinc-200 text-black font-black py-8 rounded-3xl text-3xl uppercase tracking-wider transition-all active:scale-95"
            onClick={() => setActiveModal('viewer')}
          >
            View Meet
          </button>
        </div>

        {activeModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 w-full max-w-md p-10 rounded-3xl border-2 border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black uppercase tracking-wider text-orange-500">
                  {activeModal === 'host' ? 'Host Access Code' : 'Connect to Race'}
                </h3>
                <button onClick={() => setActiveModal(null)} className="text-zinc-500 hover:text-white transition-colors text-3xl font-black">&times;</button>
              </div>
              
              <input 
                type={activeModal === 'host' ? 'password' : 'text'}
                placeholder={activeModal === 'host' ? 'Enter Access Key' : 'Enter Race Code'}
                className="w-full bg-black border-2 border-zinc-800 rounded-xl p-5 mb-6 text-xl focus:outline-none focus:border-orange-600 transition-all placeholder:text-zinc-700 uppercase"
                value={activeModal === 'host' ? accessCode : inputCode}
                onChange={e => activeModal === 'host' ? setAccessCode(e.target.value) : setInputCode(e.target.value)}
                autoFocus
              />
              
              <button 
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-xl text-xl uppercase tracking-widest shadow-[0_10px_30px_rgba(234,88,12,0.3)] transition-all active:scale-95"
                onClick={activeModal === 'host' ? createRoom : joinRoom}
              >
                {activeModal === 'host' ? 'Authorize System' : 'Establish Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono p-4 md:p-8 flex flex-col items-center overflow-x-hidden">
      {view === 'host' && (
        <header className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4 mb-8 border-b-2 border-zinc-900 pb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black tracking-tighter">ID: <span className="text-orange-500 select-all">{roomCode}</span></h2>
          </div>
          <div className="flex gap-2 flex-1 max-w-2xl w-full">
            <input 
              className="bg-zinc-900 border border-zinc-800 p-2 rounded-lg flex-1 focus:border-orange-600 outline-none text-sm"
              placeholder="Event Name"
              value={roomState?.eventName || ''}
              onChange={(e) => sendAction('UPDATE_METADATA', { eventName: e.target.value, heatNumber: roomState?.heatNumber })}
            />
            <input 
              className="bg-zinc-900 border border-zinc-800 p-2 rounded-lg w-24 focus:border-orange-600 outline-none text-sm"
              placeholder="Heat #"
              value={roomState?.heatNumber || ''}
              onChange={(e) => sendAction('UPDATE_METADATA', { eventName: roomState?.eventName, heatNumber: e.target.value })}
            />
          </div>
          <div className="bg-white text-black px-4 py-1 rounded font-black text-sm uppercase tracking-tighter">{view}</div>
        </header>
      )}
      
      <div className={`relative group flex flex-col items-center w-full ${view === 'viewer' ? 'flex-1 justify-center' : ''}`}>
        {view === 'viewer' && roomState?.eventName && (
          <div className="text-center mb-6">
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{roomState.eventName}</h1>
            {roomState.heatNumber && (
              <p className="text-orange-500 font-bold uppercase tracking-[0.4em] mt-2">Heat {roomState.heatNumber}</p>
            )}
          </div>
        )}

        {(!roomState?.releaseSplits || view === 'host') ? (
          <>
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-2xl max-h-2xl bg-orange-600/${view === 'viewer' ? '20' : '5'} rounded-full blur-[120px] transition-all duration-1000`}></div>
            <div className="text-[24vw] md:text-[18rem] font-black text-orange-400 leading-none tabular-nums tracking-[-0.05em] my-8 relative select-none drop-shadow-[0_0_30px_rgba(234,88,12,0.8)]">
              {formatTime(displayTime)}
            </div>
            <div className="text-2xl md:text-3xl font-black text-orange-600 uppercase tracking-[0.3em] mb-12 animate-pulse relative">
              {currentStatus}
            </div>
          </>
        ) : (
          <div className="w-full max-w-4xl space-y-4 px-4 overflow-y-auto max-h-[70vh]">
            <h2 className="text-orange-500 font-black text-3xl uppercase tracking-widest text-center mb-8">Official Results</h2>
            {roomState?.splits.map((time, i) => (
              <div key={i} className="flex justify-between items-center p-8 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <span className="text-zinc-600 font-black text-2xl">#{i + 1}</span>
                <span className="text-5xl font-black text-white">{formatTime(time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {view === 'host' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-6xl mb-16 relative z-10">
          <button className="bg-zinc-900 border-2 border-zinc-800 hover:bg-zinc-800 hover:scale-105 p-5 rounded-2xl font-black uppercase text-lg transition-all active:scale-90" onClick={() => sendAction('MARKS')}>Marks</button>
          <button className="bg-zinc-900 border-2 border-zinc-800 hover:bg-zinc-800 hover:scale-105 p-5 rounded-2xl font-black uppercase text-lg transition-all active:scale-90" onClick={() => sendAction('SET')}>Set</button>
          <button className="bg-orange-600 hover:bg-orange-500 hover:scale-105 p-5 rounded-2xl font-black uppercase text-2xl shadow-[0_15px_40px_rgba(234,88,12,0.3)] transition-all active:scale-90 transform active:rotate-1" onClick={() => sendAction('START')}>Start Gun</button>
          <button className="bg-amber-700 hover:bg-amber-600 hover:scale-105 p-5 rounded-2xl font-black uppercase text-lg transition-all active:scale-90" onClick={() => sendAction('FALSE_START')}>False Start</button>
          
          <button className="bg-red-700 hover:bg-red-600 hover:scale-105 p-5 rounded-2xl font-black uppercase text-lg transition-all active:scale-90" onClick={() => sendAction('CONCLUDE')}>Conclude</button>
          <button className="bg-blue-700 hover:bg-blue-600 hover:scale-105 p-5 rounded-2xl font-black uppercase text-lg transition-all active:scale-90 shadow-[0_10px_30px_rgba(37,99,235,0.2)]" onClick={() => sendAction('SPLIT')}>Split</button>
          <button 
            disabled={roomState?.status !== 'STOPPED'}
            className={`${roomState?.status !== 'STOPPED' ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' : (roomState?.releaseSplits ? 'bg-zinc-600 hover:bg-zinc-500' : 'bg-green-700 hover:bg-green-600')} p-5 rounded-2xl font-black uppercase text-lg transition-all hover:scale-105 active:scale-90`} 
            onClick={() => sendAction('RELEASE_SPLITS', !roomState.releaseSplits)}
          >
            {roomState?.releaseSplits ? 'Recall' : 'Release'}
          </button>
          <button className="bg-zinc-800 hover:bg-zinc-700 hover:scale-[1.02] p-3 rounded-2xl font-black uppercase text-sm transition-all active:scale-95" onClick={() => sendAction('RESET')}>Reset</button>
        </div>
      )}

      {view === 'viewer' && (
        <button 
          onClick={toggleFullscreen}
          className="fixed top-6 right-6 p-3 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all z-50"
          title="Toggle Fullscreen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
      )}

      {view === 'host' && (
        <div className="w-full max-w-4xl bg-zinc-900/30 rounded-3xl border-2 border-zinc-900 p-8 backdrop-blur-sm">
          <div className="flex justify-between items-end mb-8 border-b-2 border-zinc-800 pb-4">
            <h3 className="text-orange-500 font-black text-2xl uppercase tracking-tighter">Splits</h3>
            <span className="text-zinc-600 text-xs font-bold tracking-[0.5em] uppercase">{roomState?.splits.length || 0} Records Found</span>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4">
            {roomState?.splits.map((time, i) => (
              <div key={i} className="group flex justify-between items-center p-6 bg-zinc-900/50 rounded-2xl border border-transparent hover:border-orange-600/30 transition-all">
                <div className="flex items-center gap-6">
                  <span className="text-zinc-600 font-black text-xl">#{String(i + 1).padStart(2, '0')}</span>
                  <div className="h-8 w-1 bg-orange-600 rounded-full group-hover:scale-y-125 transition-transform"></div>
                  <span className="text-zinc-400 uppercase font-bold tracking-widest text-sm">Checkpoint Passed</span>
                </div>
                <span className="text-4xl font-black text-white group-hover:text-orange-500 transition-colors">{formatTime(time)}</span>
              </div>
            )).reverse()}
          </div>
        </div>
      )}
    </div>
  )
}
