const notFound=(req,res,next) => { 
    const error=new Error("Not Found- "+req.originalUrl)
    res.status(404)
    next(error)
 } 
 const errorHandler=(err,req,res,next) => { 
    const statuscode=res?.statusCode == 200 ? 500 :res.statusCode;
   return res.status(statuscode).json({message:err.message,stacktrace:err.stack})
  }
  module.exports={notFound,errorHandler}