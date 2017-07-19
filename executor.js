const SSH = require('simple-ssh');

process.send({
  event: 'output',
  data: JSON.stringify({
    type: 'info',
    message: 'connecting...',
  }),
});

const options = JSON.parse(process.argv[2]);

const ipMatch = options.server.match(/\(([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\)$/);
if (ipMatch) {
    options.server = ipMatch[1];
}

const ssh = new SSH({
    host: options.server,
    user: options.user,
    pass: options.pass,
});

ssh.exec('cat | bash -x', {
  // pty: true,
  in: options.script,
  exit: (code) => {
    process.exit(code);
  },
  out: (message) => {
    process.send({
      event: 'output',
      data: JSON.stringify({
        type: 'out',
        message: message,
      }),
    });
  },
  err: (message) => {
    process.send({
      event: 'output',
      data: JSON.stringify({
        type: 'error',
        message: message,
      }),
    });
  },
}).start({
  fail: () => {
    process.send({
      event: 'error',
      data: 'SSH connection failure',
    });
  },
});
