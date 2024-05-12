document.addEventListener('DOMContentLoaded', function() {
  displayUserLocation();
});

const ws = new WebSocket('ws://localhost:8080');
const chat = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const fontSizeRange = document.getElementById('fontSizeRange');
const userLocationsContainer = document.getElementById('userLocations');
const userCount = document.getElementById('userCount');
let username = '';
let userLocations = [];
let users = [];

while (!username) {
  username = prompt('Enter your username:');
}

ws.onopen = function () {
  ws.send(JSON.stringify({ action: 'join', username: username }));
};

ws.onmessage = function (event) {
  const data = JSON.parse(event.data);

  if (data.action === 'delete') {
    document.querySelectorAll(`p[data-id='${data.messageId}']`).forEach(el => el.remove());
  } else if (data.action === 'updateUsers') {
    users = data.users;
    updateUserList();
  } else {
    addMessageToChat(data.text, data.messageId, data.username);
    scrollToBottom();
  }
};

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
      ws.send(JSON.stringify({ action: 'delete', messageId: message.dataset.id }));
    };
    deleteButton.classList.add('delete-button');
    deleteButton.appendChild(icon);
    message.appendChild(deleteButton);
  } else {
    message.classList.add('other');
  }

  messageContainer.appendChild(message);
  chat.appendChild(messageContainer);
}

function sendMessage() {
  const messageId = Date.now().toString();
  const messageText = messageInput.value.trim();
  if (messageText) {
    const messageData = {
      text: messageText,
      messageId: messageId,
      username: username
    };
    ws.send(JSON.stringify(messageData));
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

function changeFontSize(size) {
  const chatMessages = document.querySelectorAll('.chat-message');
  chatMessages.forEach(function (message) {
    message.style.fontSize = size + 'px';
  });
}

function scrollToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

function displayUserLocation() {
  // 기존 하드코딩된 사용자 위치 표시 함수 제거
}

function updateUserList() {
  userCount.textContent = `Users: ${users.length}`;
}
