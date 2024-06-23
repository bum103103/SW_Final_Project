function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function(match) {
        switch (match) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#039;';
            default:
                return match;
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('roomId');  // URL에서 roomId 추출

    fetch('/get-username')
    .then(response => response.json())
    .then(data => {
        if (data.username) {
            console.log("Logged in as:", data.username);
            username = data.username; // 전역 변수로 username 설정
            initializeChat(roomId);
        }
    })
    .catch(error => console.error('Error fetching username:', error));
    
    fetch(`/api/messages?roomId=${roomId}`)
        .then(response => response.json())
        .then(messages => {
            messages.forEach(message => {
                addMessageToChat(message.text, message.id, message.username);
            });
            scrollToBottom();
        })
        .catch(error => console.error('Error fetching messages:', error));
      
});


const chat = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const fontSizeRange = document.getElementById('fontSizeRange');
const userCount = document.getElementById('userCount');
const userList = document.getElementById('userList');
const scrollToBottomBtn = document.getElementById('scrollToBottomBtn');
const scrollToTopBtn = document.getElementById('scrollToTopBtn');

let users = [];
//let isAdmin = false;
//let username = '';

function initializeChat(roomId) {
      
    socket.emit('joinRoom', roomId);
    console.log(`Joined room ${roomId}`);

    socket.on('message', (data) => {
        addMessageToChat(data.text, data.messageId, data.username);
    });

    socket.on('delete', (data) => {
        document.querySelectorAll(`p[data-id='${data.messageId}']`).forEach(el => el.remove());
    });

    socket.on('updateUserLocations', (data) => {
        updateUserMarkers(data.userLocations);
        users = data.users;
        updateUserList();
    });
    socket.on('joinedRoom', (roomId, markerData, adminStatus) => {
        isAdmin = adminStatus;
        updateUserList();
    });
    socket.on('kicked', (data) => {
        alert(data.message);
        window.location.href = '/map.html';
    });

    socket.on('banned', (data) => {
        if (!data.success) {
            alert(data.message);
        }
    });
    chat.addEventListener('scroll', handleScrollButtons)
}

const messageQueues = {};


function addMessageToChat(messageText, messageId, messageUsername) {
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('chat-message-container');
    var icon = document.createElement('i');
    icon.classList.add('fas', 'fa-trash');

    const message = document.createElement('p');
    message.dataset.id = messageId;
    message.classList.add('chat-message', messageUsername === username ? 'self' : 'other');
    message.style.fontSize = '40px';
    scrollToBottom();
    const formattedMessageText = `${messageUsername}: ${messageText}`;
    message.textContent = formattedMessageText;
    setTextColor(message, messageText);

    if (messageUsername === username) {
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
        let popupElement, queueKey;
        const isCluster = userMarkers[messageUsername].clusteredBy !== messageUsername || userMarkers[messageUsername].isCluster;
        
        if (isCluster) {
            let clusteredBy = userMarkers[messageUsername].clusteredBy;
            popupElement = document.getElementById(`${clusteredBy}-popup`).querySelector('.messages');
            queueKey = clusteredBy;
        } else {
            popupElement = document.getElementById(`${messageUsername}-popup`).querySelector('.messages');
            queueKey = messageUsername;
        }
    
        // 해당 사용자/클러스터의 메시지 큐가 없으면 생성
        if (!messageQueues[queueKey]) {
            messageQueues[queueKey] = [];
        }
    
        const newMessage = {
            element: document.createElement('div'),
            timestamp: Date.now()
        };
        newMessage.element.style.background = 'beige';
        newMessage.element.style.marginBottom = '5px';
        
        // 클러스터(단체 채팅방)인 경우에만 "이름: 채팅" 형식으로 표시
        if (isCluster) {
            newMessage.element.textContent = `${messageUsername}: ${messageText}`;
        } else {
            newMessage.element.textContent = messageText;
        }
    
        // 새 메시지를 큐에 추가
        messageQueues[queueKey].push(newMessage);
    
        // 큐에 3개 이상의 메시지가 있으면 가장 오래된 메시지 제거
        if (messageQueues[queueKey].length > 3) {
            const oldestMessage = messageQueues[queueKey].shift();
            oldestMessage.element.classList.add('fade-out');
            setTimeout(() => {
                if (oldestMessage.element.parentNode === popupElement) {
                    popupElement.removeChild(oldestMessage.element);
                }
            }, 1000); // 애니메이션 시간 (1초)
        }
    
        // 새 메시지를 팝업에 추가
        popupElement.appendChild(newMessage.element);
    
        // 5초 후 메시지 제거 타이머 설정
        setTimeout(() => {
            const index = messageQueues[queueKey].findIndex(msg => msg.timestamp === newMessage.timestamp);
            if (index !== -1) {
                messageQueues[queueKey].splice(index, 1);
                newMessage.element.classList.add('fade-out');
                setTimeout(() => {
                    if (newMessage.element.parentNode === popupElement) {
                        popupElement.removeChild(newMessage.element);
                    }
                }, 1000);
            }
        }, 10000);
    }
}

function sendMessage() {
    const messageId = Date.now().toString();
    var messageText = messageInput.value.trim();
    messageText = escapeHTML(messageText);
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
    requestAnimationFrame(() => {
        chat.scrollTo({
            top: chat.scrollHeight,
            behavior: 'smooth'
        });
    });
}

function scrollToTop() {
    chat.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    handleScrollButtons(); // 스크롤 후 버튼 상태 업데이트
}

function toggleChat() {
    let chat = document.getElementsByClassName('chat-container')[0];
    
    if (chat.classList.contains('show')) {
        chat.classList.remove('show');
        setTimeout(() => {
            chat.style.display = 'none';
        }, 500); 
    } else {
        chat.style.display = 'flex';
        setTimeout(() => {
            chat.classList.add('show');
            scrollToBottom();
        }, 10); 
    }
}


function updateUserList() {
    if (users && Array.isArray(users)) {
        userCount.textContent = `Users: ${users.length}`;
        userList.innerHTML = '';
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.textContent = user;
            userItem.classList.add('user-list-item');

            // 강퇴 버튼 추가
            if (isAdmin && user !== username) { // 현재 사용자가 방 관리자일 때, 본인이 아닌 경우에만 버튼을 추가
                const kickButton = document.createElement('button');
                kickButton.textContent = 'Kick';
                kickButton.classList.add('kick-button');
                kickButton.onclick = () => kickUser(user);
                userItem.appendChild(kickButton);
            }

            userList.appendChild(userItem);
        });
    } else {
        userCount.textContent = 'Users: 0';
        userList.innerHTML = '';
    }
}

function kickUser(user) {
    socket.emit('kickUser', { roomId: roomId, username: user });
}

function toggleUserList() {
    const userListElement = document.getElementById('userList');
    if (userListElement.style.display === 'none' || userListElement.style.display === '') {
        userListElement.style.display = 'block';
    } else {
        userListElement.style.display = 'none';
    }
}

function setScreenSize() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    setScreenSize();
    window.addEventListener('resize', setScreenSize);
  });

  function handleScrollButtons() {
    const scrollPosition = chat.scrollTop;
    const scrollHeight = chat.scrollHeight;
    const clientHeight = chat.clientHeight;

    if (scrollPosition + clientHeight >= scrollHeight - 10) {
        scrollToBottomBtn.style.display = 'none';
    } else {
        scrollToBottomBtn.style.display = 'block';
    }

    if (scrollPosition > 10) {
        scrollToTopBtn.style.display = 'block';
    } else {
        scrollToTopBtn.style.display = 'none';
    }
}