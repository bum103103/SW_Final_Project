document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault(); // ���� �⺻ ���� ���� ����

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

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
            return response.text().then(text => { throw new Error(text); });
        }
    })
    .catch(error => {
        document.getElementById('errorMessage').textContent = error.message;
    });
});