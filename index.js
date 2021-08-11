const express = require('express')
const app = express()
const PORT = 8000
const cors = require('cors')
const pool = require('./db')
const session = require('express-session')



app.use(cors({
    credentials: true,
    origin: 'http://localhost:3000'
  }));

app.use((req,res, next) => {
    console.log(req.url)
    next()
})
app.use(express.json())

app.use(session({ secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true ,
    cookie: { maxAge: 3600000,secure: false, httpOnly: true }
  })
);

app.get('/', async(req, res) => {
    console.log(req.session)
})

// Add user to database
app.post('/users/register', async(req, res) => {
    try{
        await pool.query('BEGIN')
        const { rows } = await pool.query('INSERT INTO users(name, username) VALUES($1,$2) RETURNING id',[req.body.name,req.body.username])
        const uid = rows[0].id
        const loginInf = await pool.query('INSERT INTO login(uid,email,password) VALUES($1,$2,$3)',[uid,req.body.email,req.body.password])
        await pool.query('COMMIT')
        req.session.uid = uid
        res.status(200).send({
            userCreate: true,
            message: "Account successfully created"
        })
    } catch(e) {
        console.log(e);
        res.status(200).send({
            userCreate: false,
            message: "Could not create user"
        })
    }
})

app.get('/users/isAuth', async (req,res) => {
    if(req.session.uid){
        let { rows } = await pool.query('SELECT username FROM users WHERE id=$1',[req.session.uid])
        res.status(200).send({
            auth: true,
            username: rows[0].username
        })
    }else{
        res.status(200).send({
            auth: false,
            username: ''
        })
    }
})

app.get('/users/:id', async(req,res) => {
    const user = req.params.id
    try{
        const { rows } = await pool.query('SELECT * FROM users WHERE id=$1',[user])
        res.status(200).send(rows[0])
    }catch{
        res.status(400).send('failed to obtain user')
    }
    
})

app.get('/users/action/signout', async(req, res) => {
    console.log("hello")
    console.log(req.session.uid)
    res.status(200).send("hello")
    if(req.session.uid !==null){
        req.session.destroy()
    }
})

app.put('/users', async(req,res) => {
    if(req.session.uid!=null){
        await pool.query('UPDATE users SET name=$1, username=$2, description=$3 WHERE id=$4',[req.body.name,req.body.username,req.body.description, req.session.uid])
        res.status(200).send()
    }else{
        res.status(400).send(null)
    }
})

app.post('/users/signin', async(req, res) => {
    try{
        let { rows } = await pool.query('SELECT * FROM login WHERE email=$1',[req.body.email])
        if(rows.length==0){
            throw Error('No such user exists')
        }
        const user = rows[0]
        if(req.body.password === user.password){
            req.session.uid = user.uid
            let { rows } = await pool.query('SELECT username FROM users WHERE id=$1',[user.uid])
            res.status(200).send({
                login: true,
                username: rows[0].username
            })
        }else{
            throw Error('Password doesnt match')
        }
    } catch(e) {
        console.log(e)
        res.status(400).send({
            login: false,
            username: ''
        })
    }
})

/* 
    API CALL:
    Returns: {
        name: String
        username: String
        description: String
        followers: Int
        following: Int
    }
*/

app.get('/users/profile/:user/header', async(req, res) => {
    const { user } = req.params
    try {
        let { rows } = await pool.query('SELECT id FROM users WHERE username=$1',[user])
        if(rows.length>0){
            const uid = rows[0].id
            
            userInf  = (await pool.query('SELECT name, username, description FROM users WHERE id=$1',[uid])).rows[0]
            followers = (await pool.query('SELECT COUNT(*) FROM followers WHERE user_id=$1',[uid])).rows[0].count
            following = (await pool.query('SELECT COUNT(*) FROM followers WHERE follower_id=$1',[uid])).rows[0].count
            const followStatus = await useIsFollow(uid,req.session.uid)

            res.status(200).send({...userInf,followers,following,followStatus})
        }else{
            throw Error('User does not exist')
        }
    } catch (e) {
        res.status(400).send(null)
        console.log(e)
    }
    
})

/* Creates a tweet in the backend, 
POST JSON
 body = {content: string} */
app.post('/tweet', async(req,res) => {
    if(req.session.uid == null){
        res.status(400).send({
            tweetCreated: false,
            message: "User not logged in"
        })
    }else{
        try{
            const { rows } = await pool.query('INSERT INTO tweets(creator_id,content,date,parent_id) VALUES($1,$2,CURRENT_TIMESTAMP,$3) RETURNING *',[req.session.uid,req.body.content,req.body.parent_id])
            const creator = (await pool.query('SELECT name, username FROM users WHERE id=$1',[req.session.uid])).rows[0]
            const tweet = rows[0]
            tweet.comments = 0
            tweet.likes = 0
            tweet.shares=0
            tweet.name = creator.name
            tweet.username = creator.username

            res.status(200).send(tweet)

        } catch(e){
            console.log(e)
            res.status(200).send(null)

        }
    }

})

app.post('/tweet/share', async(req,res) => {
    const { tweet_id } = req.body
    try{
        if(req.session.uid!=null){
            const shared = (await pool.query('SELECT EXISTS(SELECT 1 FROM shares WHERE user_id=$1 AND tweet_id=$2)',[req.session.uid,tweet_id])).rows[0].exists
            if(shared){
                await pool.query('DELETE FROM shares WHERE tweet_id =$1 AND user_id=$2',[tweet_id,req.session.uid])
            }else{
                await pool.query('INSERT INTO shares(user_id,tweet_id) VALUES($1,$2)',[req.session.uid,tweet_id])
            }
            res.status(200).send({share: !share})
        }else{
            throw Error('User not logged in')
        }
    }catch(e){
        console.log(e)
        res.status(400).send(null)
    }  
})

app.post('/tweet/createReply', async(req,res)=>{
    const { tweet_id, content} = req.body
    if(req.session.uid == null){
        res.status(400).send(null)
    }else{
        try{
            
        } catch (e){
            console.log(e)
        }
    }
})

app.get('/tweet/getTweet/:tweet_id', async(req,res) => {
    const {tweet_id} = req.params
    try{

        retObj = {}
        const tweet = (await pool.query('SELECT * FROM tweets WHERE id=$1',[tweet_id])).rows[0]
        const creator = (await pool.query('SELECT name, username FROM users WHERE id=$1',[tweet.creator_id])).rows[0]
        const replys = (await pool.query('SELECT * FROM tweets WHERE parent_id=$1 ORDER BY date DESC',[tweet_id])).rows

        //Loop through reply
        for(let i = 0;i<replys.length;i++){
            const creator = (await pool.query('SELECT name, username FROM users WHERE id=$1',[replys[i].creator_id])).rows[0]
            const cLikesReply = (await pool.query('SELECT COUNT(*) FROM likes WHERE tweet_id=$1',[replys[i].id])).rows[0].count
            const cSharesReply = (await pool.query('SELECT COUNT(*) FROM shares WHERE tweet_id=$1',[replys[i].id])).rows[0].count
            const cNumb = (await pool.query('SELECT COUNT(*) FROM tweets WHERE parent_id=$1',[replys[i].id])).rows[0].count
            replys[i].likes=cLikesReply
            replys[i].shares=cSharesReply
            replys[i].comments=cNumb
            replys[i].name=creator.name
            replys[i].username=creator.username
        }

        const cLikes = (await pool.query('SELECT COUNT(*) FROM likes WHERE tweet_id=$1',[tweet_id])).rows[0].count
        const cShares = (await pool.query('SELECT COUNT(*) FROM shares WHERE tweet_id=$1',[tweet_id])).rows[0].count

        retObj.tweet = {
            ...tweet, 
            likes: cLikes, 
            shares: cShares, 
            comments: replys.length, 
            name: creator.name, 
            username: creator.username
        }
        retObj.comments = replys
        res.status(200).send(retObj)
    }catch (e){
        console.log(e)
    }
})

app.delete('/tweet', async(req,res) => {
    const { tweetId } = req.body

    // TODO DELETE LIKES AND COMMENTS

    // Check if user made this tweet
    try{
        const { rows } = await pool.query('SELECT creator_id FROM tweets WHERE id=$1',[tweetId])
        if( rows.length>0 && req.session.uid !== null && rows[0].creator_id == req.session.uid){
            await pool.query('DELETE FROM tweets WHERE id=$1',[tweetId])
            res.status(200).send({tweetDeleted: true})
        }else{
            res.status(400).send({ tweetDeleted: false})
        }
    } catch (e) {
        console.log(e)
        res.status(400).send({ tweetDeleted: false })
    }
})

app.get('/tweet/:user/tweets', async(req,res) => {
    const { user } = req.params
    try{
        const uid = await getUID(user)
        const response = await getUsersTweets(uid)
        res.status(200).send(response)
        //res.status(200).send(rows)
    } catch(e){
        console.log(e)
    }
})

app.get('/timeline', async(req,res)=>{

    const mergeTimeline = (arr1, arr2) => {
        if(arr1.length==0){
            return arr2
        }else if(arr2.length==0){
            return arr1
        }

        const arr3 = []
        let l1 = 0
        let l2 = 0
        while(l1<arr1.length && l2<arr2.length){
            if(arr1[l1].date>arr2[l2].date){
                arr3.push(arr1[l1])
                l1++
            }else{
                arr3.push(arr2[l2])
                l2++
            }
        }
        if(l1<arr1.length){
            return arr3.concat(arr1.slice(l1))
        }else{
            return arr3.concat(arr2.slice(l2))
        }
    }

    if(req.session.uid != null){
        try{
            const following = (await pool.query('SELECT user_id FROM followers WHERE follower_id=$1',[req.session.uid])).rows
            timeline = []
            for(let i = 0;i<following.length;i++){
                const tweets = await getUsersTweets(following[i].user_id)
                timeline = mergeTimeline(timeline, tweets)
            }
            console.log(timeline)
            res.status(200).send(timeline)
        } catch (e){
            console.log(e)
        }
    }else{
        res.status(200).send(null)
    }
})

app.post('/tweet/is_liked',async(req,res)=>{
    const { tweet_id } = req.body
    if(req.session.uid!=null){
        const isLiked = (await pool.query('SELECT EXISTS(SELECT 1 FROM likes WHERE user_id=$1 AND tweet_id=$2)',[req.session.uid,tweet_id])).rows[0].exists
        res.status(200).send({ status: isLiked})
    }else{
        res.status(200).send({status: false})
    }
})

app.post('/tweet/likes', async(req, res) => {
    const { tweetId } = req.body
    try{
        if(req.session.uid!==null){
            const isLike = (await pool.query('SELECT EXISTS(SELECT 1 FROM likes WHERE user_id=$1 AND tweet_id=$2)',[req.session.uid,tweetId])).rows[0].exists
            if(!isLike){
                await pool.query('INSERT INTO likes(user_id,tweet_id) VALUES($1,$2)',[req.session.uid,tweetId])
            }else{
                await pool.query('DELETE FROM likes WHERE user_id=$1 AND tweet_id=$2',[req.session.uid,tweetId])
            }
            res.status(200).send({
                like: !isLike
            })
        }
    }catch(e){
        console.log(e)
    }
})

app.post('/follow', async(req, res) => {
    console.log(req.session.uid)
    try{
        const uid = await getUID(req.body.username)
        if(uid === req.session.uid){
            throw Error('User cannot follow themselves')
        }
        const isFollow = (await pool.query('SELECT EXISTS(SELECT 1 FROM followers WHERE user_id=$1 AND follower_id=$2)',[uid,req.session.uid])).rows[0].exists
        if(!isFollow){
            await pool.query('INSERT INTO followers(user_id, follower_id) VALUES($1,$2)',[uid,req.session.uid])
            res.status(200).send({follow: true})
        }else{
            await pool.query('DELETE FROM followers WHERE user_id=$1 AND follower_id=$2',[uid,req.session.uid])
            res.status(200).send({follow: false})
        }

    }
    catch (e) {
        console.log(e)
        res.status(400).send({
            created: false
        })
    }
})

// Returns all followers
app.get('/follow/followers/:user', async(req, res) => {
    const { user } = req.params
    try{
        const uid = await getUID(user)

        let { rows } = await pool.query('SELECT follower_id FROM followers WHERE user_id=$1',[uid])
        let ret = []
        for(let i = 0;i<rows.length;i++){
            const currFollower = await (await pool.query('SELECT * FROM users WHERE id=$1',[rows[i].follower_id])).rows[0]
            const follow = await useIsFollow(currFollower.id,req.session.uid)

            ret.push({...currFollower, follow})
        } 
        res.status(200).send(ret)
    }catch (e){
        console.log(e)
        res.status(400).send(null)
    }
})

// Returns of users the :user is following
app.get('/follow/following/:user', async(req, res) => {
    const { user } = req.params
    try{
        const uid = await getUID(user)

        let { rows } = await pool.query('SELECT user_id FROM followers WHERE follower_id=$1',[uid])
        let ret = []
        for(let i = 0;i<rows.length;i++){
            const currFollowing = await (await pool.query('SELECT * FROM users WHERE id=$1',[rows[i].user_id])).rows[0]
            const follow = await useIsFollow(currFollowing.id,req.session.uid)

            ret.push({...currFollowing, follow})
        } 
        res.status(200).send(ret)
    }catch (e){
        console.log(e)
        res.status(400).send(null)
    }
})

app.get('/message/:contact_id', async(req,res)=>{
    if(req.session.uid !=null){
        
    }else{
        res.status(400).send(null)
    }
})

app.post('/message', async(req,res) => {
    const {recipient_id, content} = req.body
    if(req.session.uid != null){
        
    }else{
        res.status(400).send(null)
    }

})

app.get('/contacts', async(req,res) => {
    if(req.session.uid != null){
        const contactsId = (await pool.query('SELECT contact_id FROM contacts WHERE user_id=$1',[req.session.uid])).rows
        const returnArray = []
        for(let i = 0;i<contactsId.length;i++){
            const contact = (await pool.query('SELECT name, username FROM users WHERE user_id=$1',[contactsId[i]])).rows[0]
            returnArray.push(contact)
        }
        res.status(200).send(returnArray)
    }else{
        res.status(400).send(null);
    }
})

app.post('/contacts', async(req,res) => {
    if(req.session.uid != null){
        const { contact_id } = req.body
        await pool.query('INSERT INTO contacts(user_id,contact_id) VALUES($1,$2)',[rqe.session.uid, contact_id])
        const contact = (await pool.query('SELECT name, username FROM users WHERE user_id=$1',[contact_id])).rows[0]
        res.status(200).send(contact)
    }else{
        res.status(400).send(null)
    }
})

app.delete('/contacts', async(req,res) =>{
    
})


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})

async function getUsersTweets(uid){
    // const shares = (await pool.query('SELECT tweet_id FROM shares WHERE user_id=$1',[uid])).rows

    // const tweets=[]

    // for(let i=0;i<shares.length;i++){
    //     const curr = await pool.query('SELECT * FROM tweets WHERE id=$1',[shares.tweet_id])
    //     tweets.push(curr)
    // }

    const { rows } = await pool.query('SELECT * FROM tweets WHERE creator_id=$1 AND parent_id IS NULL ORDER BY date DESC',[uid])
    const creator = (await pool.query('SELECT name, username FROM users WHERE id=$1',[uid])).rows[0]

    const shareList = (await pool.query('SELECT tweet_id FROM shares WHERE user_id=$1',[uid])).rows
    const tweetArr = []
    for(let i = 0;i<shareList.length;i++){
        const newTweet = (await pool.query('SELECT * FROM tweets WHERE id=$1',[shareList[i].tweet_id])).rows[0]
        const subInf = await getSubInfoTweet(newTweet.id)
        const newCreator = (await pool.query('SELECT name, username FROM users WHERE id=$1',[newTweet.creator_id])).rows[0]
        tweetArr.push({...newTweet, ...subInf, ...newCreator})
    }

    // TODO: Merge shares and tweets

    // Get number of comments, likes and shares
    for(let i = 0;i<rows.length;i++){
        const subInf = await getSubInfoTweet(rows[i].id)
        rows[i] = {...rows[i],...subInf, ...creator}
    }

    return rows
}

async function getUID(username) {
    const { rows } = await pool.query('SELECT id FROM users WHERE username=$1',[username])
    return rows[0].id
}

async function getSubInfoTweet(id){
    // Getting tweets
    const comments = (await pool.query('SELECT COUNT(*) FROM tweets WHERE parent_id=$1',[id])).rows[0].count
    const likes = (await pool.query('SELECT COUNT(*) FROM likes WHERE tweet_id=$1',[id])).rows[0].count
    const shares = (await pool.query('SELECT COUNT(*) FROM shares WHERE tweet_id=$1',[id])).rows[0].count
    return { comments, likes, shares}
}

async function useIsFollow(uid, follower_id){
    const isFollow = (await pool.query('SELECT EXISTS(SELECT 1 FROM followers WHERE user_id=$1 AND follower_id=$2)',[uid,follower_id])).rows[0].exists

    return isFollow
}

/* 
    followers:
        id: SERIAL PRIMARY KEY NOT NULL,
        user_id INTEGER NOT NULL: 
        follower_id INTEGER NOT NULL:

    users:
        id: SERIAL PRIMARY KEY,
        name VARCHAR(256) NOT NULL: 
        username VARCHAR(30) UNQIUE NOT NULL:
        description TEXT:

    login:
        id SERIAL PRIMARY KEY NOT NULL:
        uid INTEGER NOT NULL:
        email VARCHAR(320) UNIQUE NOT NULL:
        password VARCHART(64) NOT NULL: 

    tweet:
        id: SERIAL PRIMARY KEY,
        creatorId: S
        date DATE
        content TEXT,
        parent: INTEGER

    likes:
        id: SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        tweet_id INTEGER NOT NULL,

    shares:
        id: SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        tweet_id INTEGER NOT NULL

    messages:
        id: SERIAL PRIMARY KEY,
        sender_id: INTEGER NOT NULL,
        recipient_id: INTEGER NOT NULL,
        content: TEXT,
        date: TIMESTAMP

    contacts:
        id: SERIAL PRIMARY KEY,
        user_id: INTEGER NOT NULL,
        contact_id: INTEGER NOT NULL,



*/