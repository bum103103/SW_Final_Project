app.get('/login.html', (req, res) => {
    if (req.session.loggedin) {
        res.sendFile(path.join(__dirname, 'login.html'));
    } else {
        res.sendFile(path.join(__dirname, 'login.html'));
    }
});