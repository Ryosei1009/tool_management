const mysql = require('mysql2');

// 参照元（Portfolio）はルートごとに createConnection していたが、
// ここでは接続断からの復帰と同時実行のためにプールを共有する。
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
});

module.exports = pool;
module.exports.promise = pool.promise();
