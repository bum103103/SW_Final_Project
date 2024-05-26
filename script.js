

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('roomId');  // URL에서 roomId 추출

    fetch('/get-username')
    .then(response => response.json())
    .then(data => {
        if (data.username) {
            console.log("Logged in as:", data.username);
            username = data.username;
            initializeChat(roomId);
        }
    })
    .catch(error => console.error('Error fetching username:', error));
});


const chat = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const fontSizeRange = document.getElementById('fontSizeRange');
const userCount = document.getElementById('userCount');
const userList = document.getElementById('userList');

let users = [];

function initializeChat(roomId) {
    socket.emit('joinRoom', roomId);
    console.log(`Joined room ${roomId}`);

    socket.on('message', (data) => {
        addMessageToChat(data.text, data.messageId, data.username);
        scrollToBottom();
    });

    socket.on('delete', (data) => {
        document.querySelectorAll(`p[data-id='${data.messageId}']`).forEach(el => el.remove());
    });

    socket.on('updateUserLocations', (data) => {
        updateUserMarkers(data.userLocations);
        users = data.users;
        updateUserList();
    });
}

function addMessageToChat(messageText, messageId, messageUsername) {
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('chat-message-container');

    var icon = document.createElement('i');
    icon.classList.add('fas', 'fa-trash');

    const message = document.createElement('p');
    message.dataset.id = messageId;
    message.classList.add('chat-message');
    message.style.fontSize = fontSizeRange.value + 'px';

    const formattedMessageText = `${messageUsername}: ${messageText}`;
    message.textContent = formattedMessageText;

    setTextColor(message, messageText);

    if (messageUsername === username) {
        message.classList.add('self');
        const deleteButton = document.createElement('button');
        deleteButton.onclick = function () {
            socket.emit('delete', message.dataset.id);
        };
        deleteButton.classList.add('delete-button');
        deleteButton.appendChild(icon);
        message.appendChild(deleteButton);
    } else {
        message.classList.add('other');
    }

    messageContainer.appendChild(message);
    chat.appendChild(messageContainer);
    if (userMarkers[messageUsername]) {
        const popupElement = document.getElementById(`${messageUsername}-popup`).querySelector('.messages');
        const newMessage = document.createElement('div');
        newMessage.textContent = messageText;
        popupElement.appendChild(newMessage);

        // 3개 이상의 메시지가 있는 경우, 가장 오래된 메시지를 서서히 제거
        if (popupElement.children.length > 3) {
            const oldestMessage = popupElement.children[0];
            oldestMessage.classList.add('fade-out');
            setTimeout(() => {
                oldestMessage.remove();
            }, 1000); // 애니메이션 시간 (1초)과 일치시킵니다.
        }
    }
}

function sendMessage() {
    const messageId = Date.now().toString();
    const messageText = messageInput.value.trim();
    if (messageText) {
        const messageData = {
            text: messageText,
            messageId: messageId,
            username: username,
            roomId: roomId
        };
        socket.emit('message', messageData);
        messageInput.value = '';
    }
    scrollToBottom();
}

function enterkey(e) {
    if (e.keyCode === 13) {
        sendMessage();
    }
}

messageInput.addEventListener('keyup', event => enterkey(event));

function setTextColor(element, messageText) {
    const firstChar = messageText.trim().charAt(0);
    if (/[a-zA-Z]/.test(firstChar)) {
        if (firstChar.toLowerCase() == 'a') {
            element.classList.add('red');
        } else {
            element.classList.add('blue');
        }
    }
}

function scrollToBottom() {
    chat.scrollTop = chat.scrollHeight;
}

function updateUserList() {
    if (users && Array.isArray(users)) {
        userCount.textContent = `Users: ${users.length}`;
        userList.innerHTML = '';
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.textContent = user;
            userItem.classList.add('user-list-item');
            userList.appendChild(userItem);
        });
    } else {
        userCount.textContent = 'Users: 0';
        userList.innerHTML = '';
    }
}

function toggleUserList() {
    const userListElement = document.getElementById('userList');
    if (userListElement.style.display === 'none' || userListElement.style.display === '') {
        userListElement.style.display = 'block';
    } else {
        userListElement.style.display = 'none';
    }
}
