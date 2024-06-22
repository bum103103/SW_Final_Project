/**
 * 사용자 입력 문자열을 XSS 방지용으로 이스케이프 처리하는 함수
 * @param {string} str - 사용자 입력 문자열
 * @returns {string} 이스케이프 처리된 문자열
 */

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