const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
const port = process.env.PORT || 3000;
const multer = require('multer');
const jwt = require('jsonwebtoken');
const ACCESS_TOKEN_SECRET = 'D1G1W4ST3';
const REFRESH_TOKEN_SECRET = 'D1G1W4ST3_FLUTT3R_PR0J3CT';

const upload = multer();
app.use(express.json());

// MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'digiwaste',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/* =====================
   Authentication Middleware
===================== */
function generateTokens(user) {
  const accessToken = jwt.sign(
    { id_user: user.id_user, username: user.username, role: user.role },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { id_user: user.id_user },
    REFRESH_TOKEN_SECRET,
    { expiresIn: '90d' }
  );
  return { accessToken, refreshToken };
}

function authenticateAccess(req, res, next) {
  const authHeader = req.headers.authorization?.split(' ')[1];
  if (!authHeader) return res.sendStatus(401);
  jwt.verify(authHeader, ACCESS_TOKEN_SECRET, (err, payload) => {
    if (err) return res.sendStatus(403);
    req.user = payload;
    next();
  });
}

/* =====================
   User Endpoints
===================== */
app.post('/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.query(
      'SELECT id_user, foto, nama_lengkap, username, nomor_telepon, email, role FROM user WHERE username = ? AND password = ?',
      [username, password]
    );
    
    if (!rows.length) return res.status(401).json({ msg: 'Invalid credentials' });

    const user = rows[0];
    const { accessToken, refreshToken } = generateTokens(user);
    await pool.query('INSERT INTO refresh_tokens (user_id, token) VALUES (?, ?)', [user.id_user, refreshToken]);
    res.json({ accessToken, refreshToken, user });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/users/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.sendStatus(401);

    const [found] = await pool.query('SELECT user_id FROM refresh_tokens WHERE token = ?', [refreshToken]);
    if (found.length === 0) return res.sendStatus(403);

    jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, async (err, payload) => {
      if (err) return res.sendStatus(403);

      const [[userRow]] = await pool.query(
        `SELECT id_user, nama_lengkap, username, nomor_telepon, email, role
         FROM user WHERE id_user = ?`,
        [payload.id_user]
      );
      const { accessToken, refreshToken: newRefresh } = generateTokens(userRow);

      await pool.query(
        `UPDATE refresh_tokens SET token = ?, created = CURRENT_TIMESTAMP WHERE token = ?`,
        [newRefresh, refreshToken]
      );
      res.json({ accessToken, refreshToken: newRefresh });
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/users/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/users', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM User');
    res.json(results);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM User WHERE id_user = ?', [req.params.id]);
    if (results.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }
    res.json(results[0]);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/users/new', async (req, res) => {
  try {
    const { foto, nama_lengkap, username, nomor_telepon, email, password, role } = req.body;
    const [result] = await pool.query(
      `INSERT INTO User (foto, nama_lengkap, username, nomor_telepon, email, password, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [foto || null, nama_lengkap, username, nomor_telepon, email, password, role]
    );
    res.json({ status: 'success', message: 'User inserted', id_user: result.insertId });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.put('/users/edit/:id', upload.single('foto'), async (req, res) => {
  try {
    const fotoBuffer = req.file?.buffer || null;
    const data = {
      nama_lengkap: (req.body.nama_lengkap || '').trim(),
      username: (req.body.username || '').trim(),
      nomor_telepon: (req.body.nomor_telepon || '').trim(),
      email: (req.body.email || '').trim(),
      password: (req.body.password || '').trim(),
      role: (req.body.role || '').trim(),
    };

    for (const [key, value] of Object.entries(data)) {
      if (!value) return res.status(400).json({ status: 'error', message: `${key} required` });
    }

    const [result] = await pool.query(
      `UPDATE User SET
        foto = ?, nama_lengkap = ?, username = ?,
        nomor_telepon = ?, email = ?, password = ?, role = ?
       WHERE id_user = ?`,
      [fotoBuffer, ...Object.values(data), req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }
    res.json({ status: 'success', message: 'User updated' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.delete('/users/delete/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM User WHERE id_user = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }
    res.json({ status: 'success', message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/* =====================
   Transaction Endpoints
===================== */
app.get('/transaksi', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM Transaksi');
    res.json(results);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/transaksi/:id', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM Transaksi WHERE id_transaksi = ?', [req.params.id]);
    if (results.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Transaction not found' });
    }
    res.json(results[0]);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/transaksi', async (req, res) => {
  try {
    const { tanggal, waktu, total, status, id_user } = req.body;
    const [result] = await pool.query(
      `INSERT INTO Transaksi (tanggal, waktu, total, status, id_user)
       VALUES (?, ?, ?, ?, ?)`,
      [tanggal, waktu, total || null, status || 'not confirmed', id_user]
    );
    res.json({ status: 'success', message: 'Transaction created', id_transaksi: result.insertId });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.put('/transaksi/:id', async (req, res) => {
  try {
    const { tanggal, waktu, total, status, id_user } = req.body;
    const [result] = await pool.query(
      `UPDATE Transaksi SET
        tanggal = ?, waktu = ?, total = ?, status = ?, id_user = ?
       WHERE id_transaksi = ?`,
      [tanggal, waktu, total, status, id_user, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Transaction not found' });
    }
    res.json({ status: 'success', message: 'Transaction updated' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/* =====================
   Waste Bank Endpoints
===================== */
app.get('/banksampah', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM Bank_Sampah');
    res.json(results);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/banksampah/:id', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM Bank_Sampah WHERE id_sampah = ?', [req.params.id]);
    if (results.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Waste bank not found' });
    }
    res.json(results[0]);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/banksampah', async (req, res) => {
  try {
    const { nama_bank_sampah, kategori, percentage, lokasi, harga_jual, harga_beli } = req.body;
    const [result] = await pool.query(
      `INSERT INTO Bank_Sampah (nama_bank_sampah, kategori, percentage, lokasi, harga_jual, harga_beli)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nama_bank_sampah, kategori, percentage, lokasi, harga_jual, harga_beli]
    );
    res.json({ status: 'success', message: 'Waste bank created', id_sampah: result.insertId });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.put('/banksampah/:id', async (req, res) => {
  try {
    const { nama_bank_sampah, kategori, percentage, lokasi, harga_jual, harga_beli } = req.body;
    const [result] = await pool.query(
      `UPDATE Bank_Sampah SET
        nama_bank_sampah = ?, kategori = ?, percentage = ?, lokasi = ?, harga_jual = ?, harga_beli = ?
       WHERE id_sampah = ?`,
      [nama_bank_sampah, kategori, percentage, lokasi, harga_jual, harga_beli, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Waste bank not found' });
    }
    res.json({ status: 'success', message: 'Waste bank updated' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.delete('/banksampah/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM Bank_Sampah WHERE id_sampah = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Waste bank not found' });
    }
    res.json({ status: 'success', message: 'Waste bank deleted' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/* =====================
   Review Endpoints
===================== */
app.get('/reviews', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM Review');
    res.json(results);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/reviews/:id', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM Review WHERE id_review = ?', [req.params.id]);
    if (results.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Review not found' });
    }
    res.json(results[0]);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/review/new', async (req, res) => {
  try {
    const { star, komentar } = req.body;
    const [result] = await pool.query(
      'INSERT INTO Review (star, komentar) VALUES (?, ?)',
      [star, komentar]
    );
    res.json({ status: 'success', message: 'Review created', id_review: result.insertId });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/* =====================
   Category Endpoint
===================== */
app.get('/live', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM Kategori');
    res.json(results);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/* =====================
   Server Setup
===================== */
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});