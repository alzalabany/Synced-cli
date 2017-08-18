const args = {};
exports.default = {};
process.argv.forEach((val, index, array) => {
  let parts = String(val).split('=');
  if (parts.length === 2 && !args[parts[0]]) {
    exports.default[parts[0]] = parts[1];
  }
});

// and more
