import Fastify from 'fastify';

 const app = Fastify(
 {
    logger : true 
 }
 );

app.register(require('@app/cors'), {
   origin:true 
} )

app.register
try
{
    app.listen({port: 6767});
} 
catch(error)
{
    app.log.error(error);
    process.exit(1);
}


