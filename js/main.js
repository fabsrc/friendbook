var canvas = document.createElement('canvas');
var ctx = canvas.getContext('2d');
var img = new Image();
img.src = 'img/card_template.svg';
ctx.font = '30px Helvetica';

img.onload = function() {
  canvas.width = this.width;
  canvas.height = this.height;
  ctx.drawImage(img, 0, 0);
};

hello.init({ facebook: '217811635037066' });
var fb = hello('facebook');
var doc = new jsPDF();

/**
 * Draws a rounded rectangle using the current state of the canvas.
 * If you omit the last three params, it will draw a rectangle
 * outline with a 5 pixel border radius
 * @param {Number} x The top left x coordinate
 * @param {Number} y The top left y coordinate
 * @param {Number} width The width of the rectangle
 * @param {Number} height The height of the rectangle
 * @param {Number} [radius = 5] The corner radius; It can also be an object
 *                 to specify different radii for corners
 * @param {Number} [radius.tl = 0] Top left
 * @param {Number} [radius.tr = 0] Top right
 * @param {Number} [radius.br = 0] Bottom right
 * @param {Number} [radius.bl = 0] Bottom left
 * @param {Boolean} [fill = false] Whether to fill the rectangle.
 * @param {Boolean} [stroke = true] Whether to stroke the rectangle.
 */
ctx.roundRect = function(x, y, width, height, radius, fill, stroke) {
  if (typeof stroke == 'undefined') {
    stroke = true;
  }
  if (typeof radius === 'undefined') {
    radius = 5;
  }
  if (typeof radius === 'number') {
    radius = {tl: radius, tr: radius, br: radius, bl: radius};
  } else {
    var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
    for (var side in defaultRadius) {
      radius[side] = radius[side] || defaultRadius[side];
    }
  }
  this.beginPath();
  this.moveTo(x + radius.tl, y);
  this.lineTo(x + width - radius.tr, y);
  this.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  this.lineTo(x + width, y + height - radius.br);
  this.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  this.lineTo(x + radius.bl, y + height);
  this.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  this.lineTo(x, y + radius.tl);
  this.quadraticCurveTo(x, y, x + radius.tl, y);
  this.closePath();
  if (fill) {
    this.fill();
  }
  if (stroke) {
    this.stroke();
  }

};

fb.apiAll = function(path, options) {
  var self = this;
  options = options || { limit: 999 };

  return new Promise(function (resolve, reject) {
    var data = [];
    (function getPath(path) {
      self.api(path, options)
        .then(function(res) {
          data = data.concat(res.data);
          if(res.paging && res.paging.next) {
            getPath(res.paging.next);
          } else {
            resolve(data);
          }
        }, function(e) {
          reject(e);
        });
    })(path);
  });
};

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  var words = text.split(' ');
  var line = '';

  for(var n = 0; n < words.length; n++) {
    var testLine = line + words[n] + ' ';
    var metrics = context.measureText(testLine);
    var testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    }
    else {
      line = testLine;
    }
  }
  context.fillText(line, x, y);
  return y;
}

function getPhotoCount() {
  return fb.apiAll('/me/albums')
    .then(function(albums) {
      return albums.map(function(album) {
        return fb.apiAll('/me/album', {
          id: album.id,
          limit: 9999
        });
      });
    }).then(function(res) {
      return Promise.all(res);
    }).then(function(res) {
      return [].concat.apply([], res);
    });
}

function downloadCard() {
  doc.save('Friendbook_Card.pdf');
}

function getData() {
  document.getElementById('overlay').classList.add('_hidden');
  document.getElementById('spinner').classList.remove('_hidden');

  fb.login({ scope: 'email, friends, photos, user_birthday, user_hometown, user_likes, user_location, user_relationships, user_work_history, user_education_history' })
    .then(function(auth) {
      return {
        user     :  fb.api('/me?fields=id,email,cover,birthday,gender,hometown,interested_in,languages,name,relationship_status,religion,work,location,education'),
        picture  :  getPhotoCount(),
        friends  :  fb.api('/me/friends'),
        likes    :  fb.apiAll('/me/like')
      };
    }).then(function(res) {
      return Promise.props(res);
    }).then(function(results) {
      // console.log(results);

      var data = {
        id         : results.user.id,
        name       : results.user.name,
        picture    : {
            src       : 'https://graph.facebook.com/' + results.user.id + '/picture?width=400&height=400'
        },
        relationship_status: results.user.relationship_status || '',
        languages  : results.user.languages || '',
        gender     : results.user.gender || '',
        cover      : {
            src       : results.user.cover && results.user.cover.source || '',
            offset    : results.user.cover && results.user.cover.offset_y || ''
        },
        friends    : results.friends.summary.total_count,
        likes      : results.likes.length,
        photos     : results.picture.length,
        email      : results.user.email,
        birthday   : results.user.birthday && moment(results.user.birthday).format('MMMM Do YYYY') || '',
        education  : results.user.education && results.user.education[0] || '',
        hometown   : results.user.hometown && results.user.hometown.name || '',
        work       : results.user.work && results.user.work[0] || '',
        location   : results.user.location && results.user.location.name || ''
      };

      // console.log('data', data);

      createCard(data);
      return fb.logout();


    });
}

function prepareData(data) {
  return [
    [ 'Birthday', data.birthday ],
    [ 'Hometown', data.hometown ],
    [ 'Location', data.location ],
    [ 'Work', data.work.employer.name ],
    [ 'Education', data.education.school.name ]
  ];
}

function createCard(data) {
  var preparedData = prepareData(data);

  var cover = new Image();
  cover.src = data.cover.src;
  cover.crossOrigin = 'Anonymous';

  // Date
  var date = new Date();
  var textDate = date.getUTCMonth() + 1 + '/' + date.getUTCFullYear();
  ctx.font = '200 32px Helvetica';
  ctx.textAlign = 'end';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(textDate, 960, 65);


  // Friends, Photos and Likes
  ctx.font = '26px Helvetica';
  ctx.textAlign = 'start';
  ctx.fillStyle = '#909090';
  ctx.fillText(data.friends, 536, 530);
  ctx.fillText(data.photos, 730, 530);
  ctx.fillText(data.likes, 905, 530);


  // About Info

  for (var y = 770; y < 1250 && preparedData.length > 0; y += 70) {
    var content = preparedData.shift();
    ctx.font = '25px Helvetica';
    ctx.fillStyle = '#909090';
    ctx.fillText(content[0].toUpperCase(), 75, y);

    ctx.font = '35px Helvetica';
    ctx.fillStyle = '#141823';
    y = wrapText(ctx, content[1], 75, y + 45, 858, 25);
  }


  cover.onload = function() {
    ctx.drawImage(this, 0, data.cover.offset, 720, 264, 0, 100, 1000, 367);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.roundRect(40, 210, 320, 320, 3, true, true);

    var picture = new Image();
    picture.src = data.picture.src;
    picture.crossOrigin = 'Anonymous';

    picture.onload = function() {
      ctx.drawImage(this, 50, 220, 300, 300);

      // Name
      ctx.font = '400 50px Helvetica';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(data.name, 400, 430);

      document.getElementById('preview').src = canvas.toDataURL('image/png');
      document.getElementById('download').classList.remove('_hidden');
      document.getElementById('spinner').classList.add('_hidden');

      createPDF();
    };
  };
}

function createPDF() {
  doc.addImage(canvas.toDataURL('image/png'), 'JPEG', 5, 5, 64, 89);
  doc.addImage(canvas.toDataURL('image/png'), 'JPEG', 73, 5, 64, 89);
  doc.addImage(canvas.toDataURL('image/png'), 'JPEG', 141, 5, 64, 89);

  doc.addImage(canvas.toDataURL('image/png'), 'JPEG', 5, 104, 64, 89);
  doc.addImage(canvas.toDataURL('image/png'), 'JPEG', 73, 104, 64, 89);
  doc.addImage(canvas.toDataURL('image/png'), 'JPEG', 141, 104, 64, 89);

  doc.addImage(canvas.toDataURL('image/png'), 'JPEG', 5, 203, 64, 89);
  doc.addImage(canvas.toDataURL('image/png'), 'JPEG', 73, 203, 64, 89);
  doc.addImage(canvas.toDataURL('image/png'), 'JPEG', 141, 203, 64, 89);
}

function openOverlay() {
  document.getElementById('overlay').classList.remove('_hidden');
  document.getElementById('login').addEventListener('click', getData);
  document.getElementById('create').classList.add('_hidden');
}

document.getElementById('create').addEventListener('click', openOverlay);
document.getElementById('download').addEventListener('click', downloadCard);