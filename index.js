'use strict';

require('dotenv').config();
var Hapi = require('hapi');
var superagent = require('superagent');

var server = new Hapi.Server();
server.connection({
  port: process.env.PORT || 8000,
  routes: {
    cors: true
  }
});

server.route({
  method: 'POST',
  path:'/sendmail',
  config: {
    cors: {
      origin: ['*']
    }
  },
  handler: function (request, reply) {
    return sendMail(request.payload)
      .then(api_res => reply('').code(api_res.status))
      .catch(api_err => reply('').code(api_err.status))
  }
}
);

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
        if (err) fnReject(err);
        else res.statusCode === 200 ? fnResolve(res.statusCode) : fnReject(res.statusCode);
      });
  });
}

function sendMail(params) {
  let templateId, recipient;
  const substitutions = params;
  if (params.formType === 'volunteer') {
    templateId = process.env.SENDGRID_TEMPLATE_VOLUNTEER;
    recipient = process.env.RECIPIENT_VOLUNTEER;
  } else {
    templateId = process.env.SENDGRID_TEMPLATE_FUNDRAISE;
    recipient = process.env.RECIPIENT_FUNDRAISE;
  }
  const compose = {
    "personalizations": [{
        "to": [{
          "email": recipient,
          "name": "Skateistan"
        }],
        "substitutions": substitutions
    }],
    "from": {
      "email": "no-reply@skateistan.org",
      "name": "Skateistan Webforms"
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
            if (err) {
              console.log('Sendgrid /mail/send err', err);
              fnReject(err);
            }
            else fnResolve(res);
          });
      }).catch((g_res) => console.log('verifyCaptcha err', g_res));
    })
}
