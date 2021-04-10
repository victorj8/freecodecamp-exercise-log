const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const bodyParser =require('body-parser');
var mongoose = require('mongoose');
app.use(bodyParser.urlencoded({extended: false}));

app.use(cors())
app.use(express.static('public'))

// ================== DATABASE SECTION BEGIN ================

const { Schema } = mongoose;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const exerciseLogSchema = new Schema({
  description: String,
  duration: Number,
  date: Date
}, { versionKey: false });

let ExerciseLog = mongoose.model('ExerciseLog', exerciseLogSchema);

const userSchema = new Schema({
  username: String,
  log: [{type: mongoose.Schema.Types.ObjectId, ref: 'ExerciseLog'}]
}, { versionKey: false });

let User = mongoose.model('User', userSchema);

const createAndSaveUser = (username, done) => {
  let user = User({'username': username});
  user.save(function(err, data){
    if (err) return console.error(err);
    done(null , data);
  });
};

const createAndSaveExcercise = (userId, description, duration, date, done) => {
  User.findOne({_id: userId}, function(err, user){
    if (err) return console.error(err);

    var localdate = new Date();
    if(date) localdate = new Date(date);

    let exerciseLog = ExerciseLog({description: description, duration: duration, date: localdate});
    exerciseLog.save(function(err, exLog){
      if (err) return console.error(err);

      user.log.push(exLog);
      user.save(function(err, userdata){
        if (err) return console.error(err);

        done(null, userdata, exLog);
      });
    });
  });
};

const getAllUsers = (done) => {
  User.find({})
    .select('-log')
    .exec((err, data) => {
      if(err) return console.error(err);
      done(null, data);
    });
}

const queryUserLogs = (userId, from, to, limit, done) => {

  var dateFrom = new Date(-8640000000000000);
  if(from){
    var partsFrom =from.split('-');
    dateFrom = new Date(partsFrom[0], partsFrom[1] - 1, partsFrom[2]);
  }

  var dateTo = new Date(8640000000000000);
  if(to){
    var partsTo =to.split('-');
    dateTo = new Date(partsTo[0], partsTo[1] - 1, partsTo[2]);
  }

  var limitSafe = Number.MAX_SAFE_INTEGER;;
  if(limit) limitSafe = parseInt(limit);

  User.findOne({_id: userId})
    .populate({
      "path": "log",
      "match": { "date": { "$gte": dateFrom, "$lte": dateTo }},
      "options": { "limit": limitSafe},
      "select": '-_id'
    }).exec((err, data) => {
      if(err) return console.error(err);

      done(null, data);
    });
}

// ================== DATABASE SECTION END ================

// ================== ROUTE HANDLING SECTION BEGIN ================
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/exercise/new-user', (req, res) => {
  createAndSaveUser(req.body.username, (_, data) => {
    res.json({_id: data._id, username: data.username})
  });
});

app.post('/api/exercise/add', (req, res) => {
  createAndSaveExcercise(req.body.userId, req.body.description, req.body.duration, req.body.date, (_, userdata, logdata) => {
    res.json({_id: userdata._id, username: userdata.username, description: logdata.description, duration: logdata.duration,date: logdata.date})
  });
});

app.get('/api/exercise/users', (req, res) => {
  getAllUsers((_, data) => {
    res.json(data);
  });
});

app.get('/api/exercise/log', (req, res) => {
  queryUserLogs(req.query.userId, req.query.from, req.query.to, req.query.limit, (err, data)=>{
    res.json({_id: data._id, username: data.username, count: data.log.length, log: data.log});
  });
});

// ================== ROUTE HANDLING SECTION END ================

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
