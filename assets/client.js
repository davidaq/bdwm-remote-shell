(function (host) {
  var RemoteShell = {};
  window.RemoteShell = RemoteShell;
  
  var defaultOptions = {
    server: '127.0.0.1',
    port: 22,
    user: 'root',
    pass: '',
    onOutput: function (message, type) {
    },
    onFinish: function (exitCode) {
    },
    onError: function (err) {
      console.error(err);
    },
  };

  RemoteShell.execute = function (options) {
    options = Object.assign({}, defaultOptions, options);
    fetch('http://' + host + '/prepare', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(options),
    })
    .then(function (res) {
      if (res.status !== 200) {
        throw new Error('Request failed');
      }
      return res.text();
    })
    .then(function (id) {
      var sse = new EventSource('http://' + host + '/listen?' + id);
      sse.addEventListener('finish', function (event) {
        options.onFinish(event.data - 0);
        sse.close();
      });
      sse.addEventListener('output', function (event) {
        var data = JSON.parse(event.data);
        options.onOutput(data.message, data.type);
      });
    })
    .catch(function (err) {
      options.onError(err);
    });
  };
})