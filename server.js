require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')

const app = express()
app.use(express.json())

const port = process.env.PORT || 3000



const uri = 'mongodb://localhost:27017/candidateDB'
mongoose.connect(uri, {useNewUrlParser:true, useUnifiedTopology: true, useCreateIndex: true})

const connection = mongoose.connection
connection.once('open',()=>{
    console.log('MongoDB connection established sucsessfully')
})

const Schema = mongoose.Schema

// Best way is to embed the score schema as an array of test scores as below
// but as we do not know how the scores might be entered/updated,
//  ensuring uniqueness while pushing/updating {round,scores} becomes complex

// const scoreSchema = new Schema({
//     round:{type: String, required:[true,'Round Name required']},
//     score :{ type: Number, min: [0,'Score Cannot be less than 0'], max: [10,'Score Cannot be more than 10'] }
// }) 
// -------------------------------------------
//  An alternate way is to add a single subdocuemnt as below which has different rounds as key

const scoreSchema = new Schema({
    first_round :{ type: Number, min: [0,'Score Cannot be less than 0'], max: [10,'Score Cannot be more than 10'] },
    second_round :{ type: Number,min: [0,'Score Cannot be less than 0'], max: [10,'Score Cannot be more than 10'] },
    third_round :{ type: Number, min: [0,'Score Cannot be less than 0'], max: [10,'Score Cannot be more than 10']}
}) 



const candidateSchema = new Schema({
    name:{
        type :String,
        required:[true, 'Candidate Name required'],
        unique:true,
        trim:true,
        minlength:3
    },
    email:{
        type: String,
        validate: {
             validator: function(v) {
                return /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(v);
                },
            message: props => `${props.value} is not a email!`
                },
        required: [true, 'Candidate Email required']
        },
    scores:scoreSchema
})


const Candidate = mongoose.model('candidate',candidateSchema)


//  End Point to add new Candidates       
app
    .route('/api/candidate/add')
    .post((req,res)=>{
        let candidate = req.body.name
        let email = req.body.email
        const newCandidate = new Candidate({name:candidate,email:email})
        newCandidate.save((err, result)=>{
            if(!err){
                res.json('Candidate Added!')
            } else {
                res.status(400).json({'error':err})
            }
        })
    });



// End point to add scores round wise for a given user (the body must include only a single round as key)
app
    .route('/api/candidate/scores/:candidate/')  
    .post((req,res) => {
        let getCandidate = req.params.candidate
        let round = Object.keys(req.body)[0]
        let score = req.body[round]
        Candidate.findOne({name:getCandidate,},(err, result)=>{ // If we have a way to identfy a by candidate Id then it is used to find candidate instead of  name
                        if(!err){
                            if (result === null){
                                res.status(400).json({'error':'No User'})
                            } else {
                                if (result.scores){
                                    result.scores[round] = score
                                }else {
                                    result.scores = {}
                                    result.scores[round] = score
                                }
                                result.scores[round] = score
                                
                                result.save((err,state)=>{
                                    if (!err){
                                        res.json('Score Added!')
                                    }
                                    else{
                                        res.status(400).json({'error':err})
                                    }
                                })
                            }
                        } else {
                            res.status(400).json({'error':err})
                        }
                    })
    });


// End point to get high scorers

app.get('/api/gethighscore',(req,res) => {
    Candidate.aggregate([
        { $addFields: {
            total: { $sum: {
              $map: { input: { $objectToArray: "$scores" }, as: "kv", in: "$$kv.v" }
            }}
        }},
        {$group:{_id:"$total", topScorers:{$push:"$$ROOT"}}},
        { $sort: { "_id": -1 } },
        {$limit:1},
        {$project:{_id:0}}
    ]).then(result=>res.json(result))

})

// End point to get average scores of all candidates in all rounds

app.get('/api/getaveragescores',(req,res)=>{
    Candidate.aggregate([
        {$group:{_id:null,
        first_round_avg:{$avg:"$scores.first_round"},
        second_round_avg:{$avg:"$scores.second_round"},
        third_round_avg:{$avg:"$scores.third_round"}}},
        {$project:{_id:0}}
    ]).then(result=>res.json(result))
        
})


app.listen(port, err => {
    if(err) {
        return console.log(err)
    } else {
        console.log('Server successfully started')
    }
})
