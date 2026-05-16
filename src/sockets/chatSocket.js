const pool = require('../config/db');

module.exports = (io, state) => {
    const { 
        markers, 
        roomUsers, 
        roomUserLocations, 
        bannedUsers, 
        roomUserCounts, 
        roomMarkers,
        calculateCenter,
        getMarkerPositions,
        loadMarkersFromDB
    } = state;

    io.on('connection', (socket) => {
        const req = socket.request;
        if (req.session.username) {
            socket.username = req.session.username;
            console.log(`Session user: ${req.session.username}`);
        }

        Object.values(markers).forEach(marker => {
            const userCount = roomUsers[marker.id] ? roomUsers[marker.id].length : 0;
            const maxNumber = marker.max_number || 0;
            socket.emit('newMarker', {
                ...marker,
                userCount: userCount,
                maxNumber: maxNumber
            });
        });

        socket.on('joinRoom', (roomId) => {
            if (bannedUsers[roomId] && bannedUsers[roomId].includes(socket.username)) {
                socket.emit('banned', { success: false, message: 'You are banned from this room.' });
                return;
            }

            const currentUsersCount = roomUsers[roomId] ? roomUsers[roomId].length : 0;
            const maxNumber = markers[roomId] ? markers[roomId].max_number : 0;

            if (currentUsersCount >= maxNumber) {
                socket.emit('roomFull', { success: false, message: 'Room is full' });
                return;
            }

            socket.join(roomId);
            socket.room = roomId;

            if (!roomUserLocations[roomId]) roomUserLocations[roomId] = [];
            if (!roomUsers[roomId]) roomUsers[roomId] = [];

            if (!roomUsers[roomId].includes(socket.username)) {
                roomUsers[roomId].push(socket.username);
            }

            roomUserCounts[roomId] = {
                userCount: roomUsers[roomId].length,
                maxNumber: markers[roomId] ? markers[roomId].max_number : 0
            };

            const isAdmin = markers[roomId] && markers[roomId].created_by === socket.username;
            socket.emit('joinedRoom', roomId, markers[roomId], isAdmin);

            if (roomMarkers[roomId]) {
                socket.emit('markerUpdate', roomMarkers[roomId].start);
                socket.emit('markerUpdate', roomMarkers[roomId].end);
            }

            io.to(roomId).emit('updateUserLocations', {
                userLocations: roomUserLocations[roomId],
                center: calculateCenter(roomUserLocations[roomId]),
                users: roomUsers[roomId]
            });

            io.emit('updateUserCount', {
                roomId: roomId,
                userCount: roomUserCounts[roomId].userCount,
                maxNumber: roomUserCounts[roomId].maxNumber
            });

            socket.emit('adminStatus', isAdmin);
            const currentMarkers = getMarkerPositions(roomId);
            socket.emit('initialMarkers', currentMarkers);
        });

        socket.on('getAdminStatus', (roomId) => {
            const isAdmin = markers[roomId] && markers[roomId].created_by === socket.username;
            socket.emit('adminStatus', isAdmin);
        });

        socket.on('markerMove', (data) => {
            if (!roomMarkers[data.roomId]) roomMarkers[data.roomId] = {};
            roomMarkers[data.roomId][data.type] = data;
            socket.to(data.roomId).emit('markerUpdate', data);
        });

        socket.on('requestMarkerPositions', function(roomId) {
            const positions = getMarkerPositions(roomId);
            socket.emit('markerPositions', positions);
        });

        socket.on('updateLocation', (data) => {
            const { latitude, longitude, roomId } = data;
            const username = socket.username;
            const userLocation = { username, latitude, longitude };
            let userLocations = roomUserLocations[roomId] || [];

            const index = userLocations.findIndex(loc => loc.username === username);
            if (index !== -1) {
                userLocations[index] = userLocation;
            } else {
                userLocations.push(userLocation);
            }

            roomUserLocations[roomId] = userLocations;
            io.to(roomId).emit('updateUserLocations', {
                userLocations: userLocations,
                center: calculateCenter(userLocations),
                users: roomUsers[roomId]
            });
        });

        socket.on('createMarker', async (markerData) => {
            const roomId = markerData.id;
            socket.join(roomId);
            socket.room = roomId;
            markers[roomId] = markerData;
            io.emit('newMarker', markerData);

            try {
                await pool.query('INSERT INTO markers (id, title, created_by, context, latitude, longitude, max_number, type, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [markerData.id, markerData.title, markerData.created_by, markerData.context, markerData.latitude, markerData.longitude, markerData.max_number, markerData.type, markerData.image]);
                console.log('Marker saved to MySQL');
            } catch (err) {
                console.error('Error saving marker to MySQL:', err);
            }
        });

        socket.on('deleteMarker', async () => {
            const username = socket.username;
            try {
                const [results] = await pool.query('SELECT * FROM markers WHERE created_by = ?', [username]);
                if (results.length === 0) {
                    socket.emit('markerDeleteError', { success: false, message: 'No marker to delete' });
                    return;
                }

                const markerId = results[0].id;
                delete markers[markerId];
                io.emit('removeMarker', { id: markerId });
                await pool.query('DELETE FROM markers WHERE id = ?', [markerId]);
                socket.emit('markerDeleted', { success: true, message: 'Marker deleted' });
            } catch (err) {
                console.error('Error deleting marker:', err);
                socket.emit('markerDeleteError', { success: false, message: 'Database error' });
            }
        });

        socket.on('kickUser', (data) => {
            const { roomId, username } = data;
            if (socket.username === markers[roomId].created_by) {
                if (!bannedUsers[roomId]) bannedUsers[roomId] = [];
                if (!bannedUsers[roomId].includes(username)) bannedUsers[roomId].push(username);

                io.sockets.sockets.forEach(s => {
                    if (s.username === username && s.room === roomId) {
                        s.leave(roomId);
                        s.emit('kicked', { message: 'You have been kicked from the room.' });
                    }
                });

                roomUserLocations[roomId] = (roomUserLocations[roomId] || []).filter(loc => loc.username !== username);
                roomUsers[roomId] = (roomUsers[roomId] || []).filter(user => user !== username);
                
                io.to(roomId).emit('updateUserLocations', {
                    userLocations: roomUserLocations[roomId],
                    users: roomUsers[roomId],
                    center: calculateCenter(roomUserLocations[roomId] || [])
                });

                io.emit('updateUserCount', {
                    roomId: roomId,
                    userCount: (roomUsers[roomId] || []).length,
                    maxNumber: markers[roomId] ? markers[roomId].max_number : 0
                });
            }
        });

        socket.on('message', async (message) => {
            io.to(message.roomId).emit('message', { text: message.text, messageId: message.messageId, username: message.username });
            try {
                await pool.query('INSERT INTO messages (id, username, text, roomId) VALUES (?, ?, ?, ?)', [message.messageId, message.username, message.text, message.roomId]);
            } catch (err) {
                console.error('Error saving message:', err);
            }
        });

        socket.on('disconnect', async () => {
            if (socket.username) {
                try {
                    await pool.query('UPDATE user_login SET status = 0 WHERE username = ?', [socket.username]);
                } catch (err) { console.error(err); }

                if (socket.room) {
                    const roomId = socket.room;
                    roomUserLocations[roomId] = (roomUserLocations[roomId] || []).filter(user => user.username !== socket.username);
                    roomUsers[roomId] = (roomUsers[roomId] || []).filter(user => user !== socket.username);

                    io.to(roomId).emit('updateUserLocations', {
                        userLocations: roomUserLocations[roomId],
                        users: roomUsers[roomId],
                        center: calculateCenter(roomUserLocations[roomId])
                    });
                    
                    io.emit('updateUserCount', {
                        roomId: roomId,
                        userCount: roomUsers[roomId].length,
                        maxNumber: markers[roomId] ? markers[roomId].max_number : 0
                    });
                }
            }
        });
    });
};
