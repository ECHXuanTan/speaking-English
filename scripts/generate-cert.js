const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

// Tạo thư mục certs nếu chưa có
const certsDir = path.join(process.cwd(), 'certs');
if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir);
}

const keyPath = path.join(certsDir, 'server.key');
const certPath = path.join(certsDir, 'server.crt');

// Chỉ tạo certificate nếu chưa có
if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log('Tạo SSL certificate...');
    
    try {
        // Cấu hình certificate
        const attrs = [
            { name: 'countryName', value: 'VN' },
            { name: 'stateOrProvinceName', value: 'Vietnam' },
            { name: 'localityName', value: 'Ho Chi Minh City' },
            { name: 'organizationName', value: 'Exam System' },
            { name: 'commonName', value: 'exam-system' }
        ];

        const opts = {
            keySize: 2048,
            days: 365,
            algorithm: 'sha256',
            extensions: [
                {
                    name: 'keyUsage',
                    keyCertSign: true,
                    digitalSignature: true,
                    nonRepudiation: true,
                    keyEncipherment: true,
                    dataEncipherment: true
                },
                {
                    name: 'extKeyUsage',
                    serverAuth: true,
                    clientAuth: true,
                    codeSigning: true,
                    timeStamping: true
                },
                {
                    name: 'subjectAltName',
                    altNames: [
                        { type: 2, value: 'localhost' },
                        { type: 2, value: '*.local' },
                        { type: 7, ip: '127.0.0.1' },
                        { type: 7, ip: '192.168.21.107' },
                        { type: 7, ip: '0.0.0.0' }
                    ]
                }
            ]
        };

        // Tạo certificate
        const pems = selfsigned.generate(attrs, opts);
        
        // Lưu certificate và private key
        fs.writeFileSync(keyPath, pems.private);
        fs.writeFileSync(certPath, pems.cert);
        
        console.log('✅ SSL certificate đã được tạo thành công!');
        console.log(`Key: ${keyPath}`);
        console.log(`Cert: ${certPath}`);
        
    } catch (error) {
        console.error('❌ Lỗi tạo SSL certificate:', error.message);
        process.exit(1);
    }
} else {
    console.log('✅ SSL certificate đã tồn tại!');
}
