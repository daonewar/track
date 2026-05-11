require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const rooms = {};

io.on('connection', (socket) => {
    socket.on('create-room', (accessCode, callback) => {
        if (accessCode !== 'HUSKIES77') {
            return callback({ success: false, message: 'Invalid Access Code' });
        }

        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomCode] = {
            status: 'IDLE',
            startTime: null,
            splits: [],
            endTime: null,
            pauseTime: 0,
            eventName: '',
            heatNumber: '',
            releaseSplits: false
        };
        socket.join(roomCode);
        callback({ success: true, roomCode, state: rooms[roomCode] });
    });

    socket.on('join-room', (roomCode, callback) => {
        if (rooms[roomCode]) {
            socket.join(roomCode);
            callback({ success: true, state: rooms[roomCode] });
        } else {
            callback({ success: false, message: "Room not found" });
        }
    });

    socket.on('timer-action', ({ roomCode, action, payload }) => {
        const room = rooms[roomCode];
        if (!room) return;

        if (action === 'START') {
            room.status = 'RUNNING';
            room.startTime = Date.now();
        } else if (action === 'FALSE_START') {
            if (room.status === 'RUNNING') {
                room.status = 'PAUSED';
                room.pauseTime = Date.now();
            }
        } else if (action === 'RESET') {
            room.status = 'IDLE';
            room.startTime = null;
            room.splits = [];
            room.releaseSplits = false;
        } else if (action === 'CONCLUDE') {
            if (room.status === 'RUNNING' || room.status === 'PAUSED') {
                room.endTime = room.status === 'PAUSED' ? room.pauseTime : Date.now();
                room.status = 'STOPPED';
            }
        } else if (action === 'SPLIT') {
            if (room.startTime) {
                room.splits.push(Date.now() - room.startTime);
            }
        } else if (action === 'UPDATE_METADATA') {
            room.eventName = payload.eventName;
            room.heatNumber = payload.heatNumber;
        } else if (action === 'RELEASE_SPLITS') {
            if (room.status !== 'STOPPED') return;
            room.releaseSplits = payload;
        } else if (action === 'MARKS' || action === 'SET') {
            room.status = 'READY';
        }

        io.to(roomCode).emit('room-update', { action, room });
    });
});

const PORT = process.env.BACKEND_PORT || process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));