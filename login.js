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

document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();

    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;

    username = escapeHTML(username);
    // password는 이스케이프 처리하지 않고 원본 그대로 서버로 전송해야 함 (Bcrypt 해싱 목적)

    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    })
    .then(response => {
        if (response.ok) {
            window.location.href = '/';
        } else {
            return response.json();
        }
    })
    .then(data => {
        if (data && data.error) {
            document.getElementById('errorMessage').textContent = data.error;
            document.getElementById('errorMessage').style.display = 'block';
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
});