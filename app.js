
require('dotenv').config();

const express = require("express");
const app = express();
const { render } = require('ejs');
const mysql = require('mysql');
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const saltRound = 10;
const path = require('path');

const cookieParser = require('cookie-parser');
const { createTokens, validateToken } = require('./JWT');
const publicDirPath = path.join(__dirname,'./public');
const jwt = require('jsonwebtoken');

app.set('view engine', 'ejs');
app.use(express.static(publicDirPath));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());



const port = process.env.PORT || 3000;

// MySql
const pool = mysql.createPool({
    connectionLimit : 10,
    host            : process.env.DB_HOST,
    user            : process.env.DB_USER,
    password        : process.env.DB_PASS,
    database        : 'password_manager'
});

app.get("/", function(req, res) {
    pool.getConnection( function (err, connection) {
        if(err) throw err
        console.log(`connected as id ${connection.threadId}`);
    })
    res.render('index', {title: "home", msg : ""});
});

app.get("/register", function(req, res) {
    res.render('register', {title: "register", msg : ""});
});

app.get("/login", function(req, res) {
    res.render('login', {title: "login", msg : ""});
});

app.post("/login", function(req, res) {

    pool.getConnection( function (err, connection ) {
        if(err) throw err
        console.log(`connected as id ${connection.threadId}`);

        connection.query(`SELECT * FROM users WHERE username = "${req.body.username}"`, function (err, rows) {
            if(!err) {

                if(Object.keys(rows).length === 0) {
                    res.render('index', {title: "home", msg : "User not registered"})
                    return;
                }

                console.log(req.body.password);
                console.log(rows);
                bcrypt.compare(req.body.password, rows[0].password, function(err, ret) {
                    console.log("damn");
                    if(err) throw err;
                    if(ret) {

                        const accessToken = createTokens(rows[0].username, rows[0].userid)
                        res.cookie('access-token', accessToken, {
                            maxAge: 60*60*24*30*1000
                        });

                        console.log("Login Successful");
                        res.render('profile', {title: "profile", msg: "login successful"});
                        return;
                        // res.sendFile(__dirname + "/myProfile.html");
                    } else {
                        res.render('login', {title: "login", msg: "Password don't match"})
                        return;
                    }
                });
                console.log(rows);
            } else {
                console.log(err);
            }
            connection.release();
        });
    });
});

app.post("/register", function(req, res) {
    console.log(req.body);

    var password_ = req.body.password;
    var confirm_password_ = req.body.confirm_password;
    var master_password_ = req.body.master_password;
    var confirm_master_password_ = req.body.confirm_master_password;

    
    if(password_.localeCompare(confirm_password_) != 0) {
        res.render('index', {title: "home", msg : "Password and Confirm Password don't match"});
        return;
    }

    if(master_password_.localeCompare(confirm_master_password_) != 0) {
        res.render('index', {title: "home", msg : "Master Password and Confirm Master Password don't match"});
        return;
    }

    // check if username is already registered or not


    pool.getConnection( function (err, connection ) {
        if(err) throw err
        console.log(`connected as id ${connection.threadId}`);

        connection.query(`SELECT * FROM users WHERE username = "${req.body.username}" OR email = "${req.body.email}"`, function (err, rows) {
            if(!err) {
                if(Object.keys(rows) === 0) {
                    res.render('index', {title: "home", msg : "User already registered"})
                    return;
                }
            } else {
                console.log(err);
            }
            connection.release();
        });
    });


    var newUser = {}
    newUser.username = req.body.username;
    newUser.email = req.body.email;
    newUser.master_password = req.body.master_password;

    hashIt(function() {
        console.log(newUser);

        pool.getConnection( function (err, connection ) {
            if(err) throw err
            console.log(`connected as id ${connection.threadId}`);

            connection.query('INSERT INTO users SET ?', newUser, function (err, rows) {
                if(!err) {
                    console.log(rows);
                } else {
                    console.log(err);
                }
                connection.release();
            });
        });
        res.render('index', {title: "home", msg : "User Registered"});
        return;
    });  

    function hashIt(callback) {
        bcrypt.hash(req.body.password, saltRound, function(err, hash) {
            if(err) throw err;
            console.log(hash);
            newUser.password = hash;
            callback();
        });
    }
    
});

app.get('/profile', validateToken, (req, res) => {
    
    var ca = req.cookies['access-token'];
    var decodedValue = jwt.verify(ca, "jwtsecretplschange");
    console.log(decodedValue);


    res.render('profile', {title: "profile", msg : ""});
})

app.get('/storePassword', validateToken, (req, res) => {
    res.render('storePassword', {title: "store password", msg: ""});
})

app.post('/storePassword', validateToken, (req, res) => {
    var ca = req.cookies['access-token'];
    var decodedValue = jwt.verify(ca, "jwtsecretplschange");
    var userid_ = decodedValue.id;

    console.log(req.body);

    var pass_row = {}
    pass_row.userid = userid_;
    pass_row.title = req.body.title;
    pass_row.email = req.body.email;

    hashIt(function() {
        
        pool.getConnection( function (err, connection ) {
            if(err) throw err
            console.log(`connected as id ${connection.threadId}`);

            connection.query('INSERT INTO passlist SET ?', pass_row, function (err, rows) {
                if(!err) {
                    console.log(rows);
                } else {
                    console.log(err);
                }
                connection.release();
            });
        });
        res.render('profile', {title: "profile", msg: "password stored"});
        return;

    });  

    function hashIt(callback) {
        bcrypt.hash(req.body.password, saltRound, function(err, hash) {
            if(err) throw err;
            console.log(hash);
            // pass_row.password = hash;
            pass_row.password = req.body.password;
            callback();
        });
    }

})

app.post('/DeletePasswordWithTitle', validateToken, (req, res) => {
    var ca = req.cookies['access-token'];
    var decodedValue = jwt.verify(ca, "jwtsecretplschange");
    var userid_ = decodedValue.id;

    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log(`connected as id: ${connection.threadId}`)

        // query(sqlstring, callback fun)
        connection.query('DELETE from passlist WHERE userid = ' + userid_ + " AND title = '" + req.body.title + "'", (err, rows) => {
             // return the conneciton to pool

            if(!err) {
                // console.log(rows[0].staff_id)
                // res.render('searchPassword', {rows: rows, title: "Search Password", msg : ""})
                connection.release()
                
                pool.getConnection((err, connection) => {
                    if(err) throw err
                    console.log(`connected as id: ${connection.threadId}`)
            
                    // query(sqlstring, callback fun)
                    connection.query('SELECT * from passlist WHERE userid = ' + userid_, (err, rows) => {
                        connection.release() // return the conneciton to pool
            
                        if(!err) {
                            // console.log(rows[0].staff_id)
                            res.render('searchPassword', {rows: rows, title: "Search Password", msg : ""})
                            return;
                        } else {
                            console.log(err)
                        }
                    })
                })




                return;
            } else {
                console.log(err)
            }
            connection.release();
        })
    })

})

app.post('/searchPasswordWithTitle', validateToken, (req, res) => {
    var ca = req.cookies['access-token'];
    var decodedValue = jwt.verify(ca, "jwtsecretplschange");
    var userid_ = decodedValue.id;

    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log(`connected as id: ${connection.threadId}`)

        // query(sqlstring, callback fun)
        connection.query('SELECT * from passlist WHERE userid = ' + userid_ + " AND title = '" + req.body.title + "'", (err, rows) => {
            connection.release() // return the conneciton to pool

            if(!err) {
                // console.log(rows[0].staff_id)
                res.render('searchPassword', {rows: rows, title: "Search Password", msg : ""})
                return;
            } else {
                console.log(err)
            }
            connection.release();
        })
    })

})


app.get('/searchPassword', validateToken, (req, res) => {

    var ca = req.cookies['access-token'];
    var decodedValue = jwt.verify(ca, "jwtsecretplschange");
    var userid_ = decodedValue.id;

    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log(`connected as id: ${connection.threadId}`)

        // query(sqlstring, callback fun)
        connection.query('SELECT * from passlist WHERE userid = ' + userid_, (err, rows) => {
            connection.release() // return the conneciton to pool

            if(!err) {
                // console.log(rows[0].staff_id)
                res.render('searchPassword', {rows: rows, title: "Search Password", msg : ""})
                return;
            } else {
                console.log(err)
            }
        })
    })
})

app.listen(port, function() {
    console.log("Server started on port " + port);
}); 