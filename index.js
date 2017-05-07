'use strict';

require('dotenv').config();
var Hapi = require('hapi');
var superagent = require('superagent');

var server = new Hapi.Server();
server.connection({
  host: 'localhost',
  port: 8000,
  routes: {
    cors: true
  }
});

// Add the route
server.route({
  method: 'POST',
  path:'/sendmail',
  handler: function (request, reply) {
    console.log('Request payload: ', request.payload);
    return sendMail(request.payload)
      .then(api_res => reply('').code(api_res.status))
      .catch(api_err => reply('').code(api_err.status))
  }
}
);

// Start the server
server.start((err) => {
  if (err) {
      throw err;
  }
  console.log('Server running at:', server.info.uri);
});

function verifyCaptcha(req){
  let params = {
    secret: process.env.CAPTCHA_SECRET_KEY,
    response: req.recaptcha
  }
  return new Promise((fnResolve, fnReject)=>{
    superagent.post('https://www.google.com/recaptcha/api/siteverify')
      .set('Content-Type', 'application/json')
      .send(params)
      .end((err, res)=>{
        console.log('Recaptcha - res statusCode', res.statusCode);
        if (err) fnReject(err);
        else res.statusCode === 200 ? fnResolve(res.statusCode) : fnReject(res.statusCode);
      });
  });
}

function sendMail(params) {
  let templateId;
  const substitutions = params
  if (params.formType === 'volunteer') {
    templateId = process.env.SENDGRID_TEMPLATE_VOLUNTEER;
  } else {
    templateId = process.env.SENDGRID_TEMPLATE_FUNDRAISE;
  }
  const compose = {
    "personalizations": [{
        "to": [{
          "email": process.env.RECIPIENT,
          "name": "Skateistan"
        }],
        "substitutions": substitutions
    }],
    "from": {
      "email": params.res_email,
      "name": params.full_name
    },
    "template_id": templateId
  };

  return new Promise((fnResolve, fnReject)=>{
      verifyCaptcha(params).then((api_res)=>{
        superagent.post('https://api.sendgrid.com/v3/mail/send')
          .set('Content-Type', 'application/json')
          .set('Authorization', 'Bearer ' + process.env.SENDGRID_API_KEY)
          .send(compose)
          .end((err, res)=>{
            console.log('Sendgrid res', res.statusCode);
            if (err) fnReject(err);
            else fnResolve(res);
          });
      }).catch((g_res) => console.log('Captcha catch', g_res));
    })
}
