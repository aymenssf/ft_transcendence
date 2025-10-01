import express from 'express';
import cors from 'cors';


const app = express();
const PORT = process.env.PORT || 3013;

app.use(cors());
app.use(express.json());


app.get('/ai', (req, res)=>
{
  res.json({status: 'DONE' , service: "ai-service"});   
});

app.get('/api/ai/test', (req, res) => {
  res.json({ 
    message: 'AI service is ready',
    service: 'ai-service'
  });
});


app.post('/api/ai/move', (req, res) => {

  const { gameState, difficulty } = req.body;
  
  res.json({
    direction: 'stop',
    message: 'AI logic not implemented yet'
  });
});
  


app.listen(PORT, () =>
{
    console.log("the service of the ai is working ");
});