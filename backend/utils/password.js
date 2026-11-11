// パスワードのルール：8文字以上・英字と数字を両方含む・社員IDと同じ文字列は不可。
// bcrypt は 72 バイトまでしか見ないので、それより長いものは受け付けない。
const MIN_LENGTH = 8;
const MAX_BYTES = 72;

const PASSWORD_RULE = '8文字以上で、英字と数字の両方を含めてください。';

// 問題があればその理由（文字列）、なければ null
const validatePassword = (password, employeeId) => {
    if (typeof password !== 'string' || password.length < MIN_LENGTH) {
        return `パスワードは${PASSWORD_RULE}`;
    }
    if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) return 'パスワードが長すぎます。';
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return `パスワードは${PASSWORD_RULE}`;
    if (employeeId && password.toLowerCase() === String(employeeId).toLowerCase()) {
        return '社員IDと同じパスワードは使えません。';
    }
    return null;
};

module.exports = { validatePassword, PASSWORD_RULE };
