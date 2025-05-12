const express = require('express');
const mysql = require('mysql2');
const app = express();
const port = process.env.PORT || 3000;
const multer = require('multer');

const upload = multer();

// Middleware untuk parsing JSON
app.use(express.json());

// Koneksi ke database MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'digiwaste'
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL database.');
});

/* =====================
   Endpoint User
===================== */

// Ambil semua user
app.get('/users', (req, res) => {
  connection.query('SELECT * FROM User', (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err });
    res.json(results);
  });
});


// Ambil user berdasarkan id
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  connection.query('SELECT * FROM User WHERE id_user = ?', [userId], (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err });
    if (results.length === 0) return res.status(404).json({ status: 'error', message: 'User not found' });
    res.json(results[0]);
  });
});

// Insert user baru
app.post('/users/new', (req, res) => {
  const { foto, nama_lengkap, username, nomor_telepon, email, password, role } = req.body;
  const query = `INSERT INTO User (foto, nama_lengkap, username, nomor_telepon, email, password, role)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
  connection.query(query, [foto || null, nama_lengkap, username, nomor_telepon, email, password, role],
    (err, result) => {
      if (err) return res.status(500).json({ status: 'error', message: err });
      res.json({ status: 'success', message: 'User inserted successfully', id_user: result.insertId });
  });
});

// Update user
app.put('/users/edit/:id', upload.none(), (req, res) => {
  // Cetak seluruh req.body untuk debugging
  console.log("Received req.body:", req.body);

  // Trim setiap field
  const trimmedData = {
    foto: req.body.foto, // Tidak trim karena mungkin null atau file
    nama_lengkap: req.body.nama_lengkap ? req.body.nama_lengkap.trim() : '',
    username: req.body.username ? req.body.username.trim() : '',
    nomor_telepon: req.body.nomor_telepon ? req.body.nomor_telepon.trim() : '',
    email: req.body.email ? req.body.email.trim() : '',
    password: req.body.password ? req.body.password.trim() : '',
    role: req.body.role ? req.body.role.trim() : ''
  };

  // Validasi: Pastikan semua field wajib tidak kosong
  if (!trimmedData.nama_lengkap || !trimmedData.username || !trimmedData.nomor_telepon || !trimmedData.email || !trimmedData.password || !trimmedData.role) {
    return res.status(400).json({ status: 'error', message: 'Data tidak boleh kosong!' });
  }

  const userId = req.params.id;
  const query = `UPDATE User SET foto = ?, nama_lengkap = ?, username = ?, nomor_telepon = ?, email = ?, password = ?, role = ? WHERE id_user = ?`;
  
  connection.query(query, [
      trimmedData.foto || null, 
      trimmedData.nama_lengkap, 
      trimmedData.username, 
      trimmedData.nomor_telepon, 
      trimmedData.email, 
      trimmedData.password, 
      trimmedData.role, 
      userId
    ],
    (err, result) => {
      if (err) {
        console.error("SQL Error:", err);
        return res.status(500).json({ status: 'error', message: err });
      }
      res.json({ status: 'success', message: 'User updated successfully' });
  });
});
// Delete user
app.delete('/users/delete/:id', (req, res) => {
  const userId = req.params.id;
  connection.query('DELETE FROM User WHERE id_user = ?', [userId], (err, result) => {
    if (err) return res.status(500).json({ status: 'error', message: err });
    res.json({ status: 'success', message: 'User deleted successfully' });
  });
});

/* =====================
   Endpoint Transaksi
===================== */

// Ambil semua transaksi
app.get('/transaksi', (req, res) => {
  connection.query('SELECT * FROM Transaksi', (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err });
    res.json(results);
  });
});

// Ambil transaksi berdasarkan id
app.get('/transaksi/:id', (req, res) => {
  const transaksiId = req.params.id;
  connection.query('SELECT * FROM Transaksi WHERE id_transaksi = ?', [transaksiId], (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err });
    if (results.length === 0) return res.status(404).json({ status: 'error', message: 'Transaksi not found' });
    res.json(results[0]);
  });
});

// Insert transaksi baru
app.post('/transaksi', (req, res) => {
  const { tanggal, waktu, total, status, id_user } = req.body;
  const query = `INSERT INTO Transaksi (tanggal, waktu, total, status, id_user)
                 VALUES (?, ?, ?, ?, ?)`;
  connection.query(query, [tanggal, waktu, total || null, status || 'not confirmed', id_user],
    (err, result) => {
      if (err) return res.status(500).json({ status: 'error', message: err });
      res.json({ status: 'success', message: 'Transaksi inserted successfully', id_transaksi: result.insertId });
  });
});

// Update transaksi
app.put('/transaksi/:id', (req, res) => {
  const transaksiId = req.params.id;
  const { tanggal, waktu, total, status, id_user } = req.body;
  const query = `UPDATE Transaksi SET tanggal = ?, waktu = ?, total = ?, status = ?, id_user = ? 
                 WHERE id_transaksi = ?`;
  connection.query(query, [tanggal, waktu, total || null, status, id_user, transaksiId],
    (err, result) => {
      if (err) return res.status(500).json({ status: 'error', message: err });
      res.json({ status: 'success', message: 'Transaksi updated successfully' });
  });
});

/* =====================
   Endpoint Bank Sampah
===================== */

// Ambil semua data bank sampah
app.get('/banksampah', (req, res) => {
  connection.query('SELECT * FROM Bank_Sampah', (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err });
    res.json(results);
  });
});

// Ambil bank sampah berdasarkan id
app.get('/banksampah/:id', (req, res) => {
  const id = req.params.id;
  connection.query('SELECT * FROM Bank_Sampah WHERE id_sampah = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err });
    if (results.length === 0) return res.status(404).json({ status: 'error', message: 'Bank Sampah not found' });
    res.json(results[0]);
  });
});

// Insert bank sampah baru
app.post('/banksampah', (req, res) => {
  const { nama_bank_sampah, kategori, percentage, lokasi, harga_jual, harga_beli } = req.body;
  const query = `INSERT INTO Bank_Sampah (nama_bank_sampah, kategori, percentage, lokasi, harga_jual, harga_beli)
                 VALUES (?, ?, ?, ?, ?, ?)`;
  connection.query(query, [nama_bank_sampah, kategori, percentage, lokasi, harga_jual, harga_beli],
    (err, result) => {
      if (err) return res.status(500).json({ status: 'error', message: err });
      res.json({ status: 'success', message: 'Bank Sampah inserted successfully', id_sampah: result.insertId });
  });
});

// Update bank sampah
app.put('/banksampah/:id', (req, res) => {
  const id = req.params.id;
  const { nama_bank_sampah, kategori, percentage, lokasi, harga_jual, harga_beli } = req.body;
  const query = `UPDATE Bank_Sampah SET nama_bank_sampah = ?, kategori = ?, percentage = ?, lokasi = ?, harga_jual = ?, harga_beli = ? 
                 WHERE id_sampah = ?`;
  connection.query(query, [nama_bank_sampah, kategori, percentage, lokasi, harga_jual, harga_beli, id],
    (err, result) => {
      if (err) return res.status(500).json({ status: 'error', message: err });
      res.json({ status: 'success', message: 'Bank Sampah updated successfully' });
  });
});

// Delete bank sampah
app.delete('/banksampah/:id', (req, res) => {
  const id = req.params.id;
  connection.query('DELETE FROM Bank_Sampah WHERE id_sampah = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ status: 'error', message: err });
    res.json({ status: 'success', message: 'Bank Sampah deleted successfully' });
  });
});

/* =====================
   Endpoint Review
===================== */

// Ambil semua review
app.get('/reviews', (req, res) => {
  connection.query('SELECT * FROM Review', (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err });
    res.json(results);
  });
});

// Ambil review berdasarkan id
app.get('/reviews/:id', (req, res) => {
  const id = req.params.id;
  connection.query('SELECT * FROM Review WHERE id_review = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err });
    if (results.length === 0) return res.status(404).json({ status: 'error', message: 'Review not found' });
    res.json(results[0]);
  });
});

// Insert review baru
app.post('/review/new', (req, res) => {
  const { star, komentar } = req.body;
  const query = `INSERT INTO Review (star, komentar) VALUES (?, ?)`;
  connection.query(query, [star, komentar], (err, result) => {
    if (err) return res.status(500).json({ status: 'error', message: err });
    res.json({ status: 'success', message: 'Review inserted successfully', id_review: result.insertId });
  });
});

// Ambil semua data bank sampah
app.get('/live', (req, res) => {
  connection.query('SELECT * FROM Kategori', (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err });
    res.json(results);
  });
});

/* =====================
   Jalankan Server
===================== */
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});