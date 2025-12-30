// Socket.IO instance will be set here
let ioInstance = null;

module.exports = {
  setIO: (io) => {
    ioInstance = io;
  },
  getIO: () => {
    return ioInstance;
  },
};

