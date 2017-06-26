const SSH = require('simple-ssh');

process.send({
  event: 'output',
  data: JSON.stringify({
    type: 'info',
    message: 'connecting...',
  }),
});

const options = JSON.parse(process.argv[2]);

const ssh = new SSH({
    host: options.server,
    user: options.user,
    pass: options.pass,
});

ssh.exec('cat | bash -x', {
  pty: true,
  in: options.script,
  exit: function (code) {
    process.exit(code);
  },
  out: function (message) {
    process.send({
      event: 'output',
      data: JSON.stringify({
        type: 'out',
        message: message,
      }),
    });
  },
  err: function (message) {
    process.send({
      event: 'output',
      data: JSON.stringify({
        type: 'error',
        message: message,
      }),
    });
  },
}).start({
  fail: function () {
    process.send({
      event: 'fail',
      data: 'fail',
    });
  },
});
