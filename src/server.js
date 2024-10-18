const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const conf = JSON.parse(fs.readFileSync(path.join(__dirname, 'conf.json'), 'utf8')); 
if (!conf) {
    console.log('Error: conf.json not found');
}

io.on('connection', (socket) => {
    console.log('Client connected');

    let routerConn = new Client();
    socket.on('ssh-connect', (data) => {
        const routerUser="test"
        const routerPw = "test"
        const { lab_number, destHost} = data; //User need to input lab_number and destination host
        
        // Step 1: SSH into the router
        routerConn.on('ready', () => {
            socket.emit('data', '\r\n*** CONNECTED TO ROUTER ***\r\n');

            // Step 2: SSH into the destination from the router's shell
            routerConn.exec(`ssh ${destUsername}@${destHost}`, (err, stream) => {
                if (err) {
                    socket.emit('data', '\r\n*** SSH TO DESTINATION ERROR: ' + err.message + ' ***\r\n');
                    return;
                }

                socket.emit('data', `\r\n*** CONNECTED TO DESTINATION ${destHost} ***\r\n`);

                // Handle user input
                socket.on('input', (input) => {
                    stream.write(input); // Write input to the destination shell
                });

                // Forward data from the destination shell to the terminal
                stream.on('data', (data) => {
                    socket.emit('data', data.toString());
                }).on('close', () => {
                    routerConn.end();
                });
            });
        }).on('error', (err) => {
            socket.emit('data', '\r\n*** SSH TO ROUTER ERROR: ' + err.message + ' ***\r\n');
        }).connect({
            host: routerHost,
            port: routerPort || 22,
            username: routerUsername,
            password: routerPassword
        });
    });

    socket.on('disconnect', () => {
        routerConn.end(); // Close the router connection
    });
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
