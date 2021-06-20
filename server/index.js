const keys = require('./keys');

//Express setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();  //request and receive any http request
app.use(cors()); //cross operation resourse sharing transfer data from one domain to another Eg react to postgres
app.use(bodyParser.json()); //parse the input request and again parse the output request to json file

//postgress setup
const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
});

pgClient.on("connect", (client) => {
    client
      .query("CREATE TABLE IF NOT EXISTS values (number INT)")
      .catch((err) => console.error(err));
  });

//Redis connection
const redis = require('redis');
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate(); //as mentioned in the redis documentation, when client is creating or publishing no other must be connected hence we use duplicate.

//express route handlers
app.get('/', (req, res) => {
    res.send('Hi');
});

//using below command to fetch all the entries present in the postgress databases
app.get('/values/all', async (req, res) => {
    const values = await pgClient.query('SELECT * from values');
    res.send(values.rows);
});

//get data from redis server
app.get('/values/current', async (req, res) => {
   redisClient.hgetall('values', (err, values) => {
       res.send(values);
   });
});

//receive new vales from react
app.post('/values', async (req, res) => {
    const index = req.body.index;

    if(parseInt(index) > 40){
        return res.status(422).send('index too high');
    }

    redisClient.hset('values', index , 'Nothing Yet!');
    redisPublisher.publish('insert', index);
    pgClient.query('INSERT into values(number) VALUES($1)', [index]);
    
    res.send({ working: true});
});

app.listen(5000, err => {
    console.log('Listening');
});