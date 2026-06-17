const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const shortid = require('shortid');

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));

// Connect to SQLite
const db = new sqlite3.Database('./urls.db');

// Create table if it doesn't exist
db.run(`
CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full TEXT NOT NULL,
    short TEXT UNIQUE NOT NULL,
    clicks INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME
)
`);

// Helper function to render homepage with error
function renderHomeWithError(res, message) {
    db.all("SELECT * FROM urls", [], (err, rows) => {
        if (err) return res.status(500).send(err.message);

        res.render('index', {
            shortUrls: rows,
            error: message
        });
    });
}

// Home page
app.get('/', (req, res) => {
    db.all("SELECT * FROM urls", [], (err, rows) => {
        if (err) return res.status(500).send(err.message);

        res.render('index', {
            shortUrls: rows,
            error: null
        });
    });
});

// Create short URL
app.post('/shortUrls', (req, res) => {
    const full = req.body.fullUrl;

    // Validate URL
    try {
        const url = new URL(full);

        // Allow only HTTP/HTTPS
        if (!['http:', 'https:'].includes(url.protocol)) {
            return renderHomeWithError(
                res,
                "Only HTTP/HTTPS URLs are allowed."
            );
        }

        // Hostname must contain a dot
        if (!url.hostname.includes('.')) {
            return renderHomeWithError(
                res,
                "Please enter a valid URL."
            );
        }

    } catch {
        return renderHomeWithError(
            res,
            "Please enter a valid URL."
        );
    }

    // Generate short code
    const short = shortid.generate();

    // Save to database
    db.run(
        "INSERT INTO urls (full, short) VALUES (?, ?)",
        [full, short],
        function (err) {
            if (err) {
                return renderHomeWithError(
                    res,
                    "Something went wrong. Please try again."
                );
            }

            res.redirect('/');
        }
    );
});

// Redirect short URL
app.get('/:shortUrl', (req, res) => {
    const short = req.params.shortUrl;

    db.get(
        "SELECT * FROM urls WHERE short = ?",
        [short],
        (err, row) => {
            if (err) {
                return res.status(500).send(err.message);
            }

            if (!row) {
                return res.status(404).render('404');
            }

            db.run(
                `UPDATE urls
                 SET clicks = clicks + 1,
                     last_accessed = CURRENT_TIMESTAMP
                 WHERE short = ?`,
                [short]
            );

            res.redirect(row.full);
        }
    );
});

// Delete URL
app.post('/delete/:id', (req, res) => {
    db.run(
        "DELETE FROM urls WHERE id = ?",
        [req.params.id],
        function(err) {
            if (err) {
                return res.status(500).send(err.message);
            }

            res.redirect('/');
        }
    );
});

app.listen(process.env.PORT || 5000, () => {
    console.log("Server running on port 5000");
});