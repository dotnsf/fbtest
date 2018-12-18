//. app.js

//. https://qiita.com/xiushu53/items/f2d699704d7325d02169

//. https://gist.github.com/xl1/fe779a817a9d4938193d

var express = require( 'express' ),
    basicAuth = require( 'basic-auth-connect' ),
    cors = require( 'cors' ),
    cfenv = require( 'cfenv' ),
    easyimg = require( 'easyimage' ),
    multer = require( 'multer' ),
    bodyParser = require( 'body-parser' ),
    fs = require( 'fs' ),
    ejs = require( 'ejs' ),
    cloudantlib = require( '@cloudant/cloudant' ),
    uuidv1 = require( 'uuid/v1' ),
    app = express();
var settings = require( './settings' );

var db = null;
var cloudant = cloudantlib( { account: settings.db_username, password: settings.db_password } );
if( cloudant ){
  cloudant.db.get( settings.db_name, function( err, body ){
    if( err ){
      if( err.statusCode == 404 ){
        cloudant.db.create( settings.db_name, function( err, body ){
          if( err ){
            db = null;
          }else{
            db = cloudant.db.use( settings.db_name );
          }
        });
      }else{
        db = cloudant.db.use( settings.db_name );
      }
    }else{
      db = cloudant.db.use( settings.db_name );
    }
  });
}

var appEnv = cfenv.getAppEnv();

app.all( '/admin', basicAuth( function( user, pass ){
  if( settings.admin_username && settings.admin_password ){
    return ( settings.admin_username === user && settings.admin_password === pass );
  }else{
    return false;
  }
}));

app.use( multer( { dest: './tmp/' } ).single( 'image' ) );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );
app.use( express.Router() );
app.use( express.static( __dirname + '/public' ) );

app.set( 'views', __dirname + '/public' );
app.set( 'view engine', 'ejs' );

//app.use( cors() );
app.get( '/', function( req, res ){
  res.render( 'index', { base_url: settings.base_url, app_id: settings.fb_app_id } );
});

/*
app.get( '/admin', function( req, res ){
  if( db ){
    db.list( { include_docs: true }, function( err, body ){
      if( err ){
        res.render( 'admin', { base_url: settings.base_url, images: [], message: err } );
      }else{
        var total = body.total_rows;
        var images = [];
        body.rows.forEach( function( doc ){
          var _doc = JSON.parse(JSON.stringify(doc.doc));
          if( _doc._id.indexOf( '_' ) !== 0 ){
            _doc.timestamp = timestamp2datetime( _doc.timestamp );
            images.push( _doc );
          }
        });
      }
      res.render( 'admin', { base_url: settings.base_url, images: images, message: ''} );
    });
  }else{
    res.render( 'admin', { base_url: settings.base_url, images: [], messages: 'db is failed to initialize.' } );
  }
});
*/

app.post( '/image', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var imgpath = req.file.path;
  var imgtype = req.file.mimetype;
  //var imgsize = req.file.size;
  var ext = imgtype.split( "/" )[1];
  var imgfilename = req.file.filename;
  var filename = req.file.originalname;
  var uid = req.body.uid;
  var caption = req.body.caption;

  var image_id = uuidv1();
  var img = fs.readFileSync( imgpath );
  var img64 = new Buffer( img ).toString( 'base64' );

  var params2 = {
    _id: image_id,
    filename: filename,
    uid: uid,
    caption: caption,
    timestamp: ( new Date() ).getTime(),
    _attachments: {
      image: {
        content_type: imgtype,
        data: img64
      }
    }
  };
  db.insert( params2, image_id, function( err2, body2, header2 ){
    if( err2 ){
      console.log( err2 );
      var p = JSON.stringify( { status: false, error: err2 }, null, 2 );
      res.status( 400 );
      res.write( p );
      res.end();
    }else{
      var p = JSON.stringify( { status: true, id: image_id, body: body2 }, null, 2 );
      res.write( p );
      res.end();
    }
    fs.unlink( imgpath, function( err ){} );
  });
});

app.get( '/image', function( req, res ){
  var image_id = req.query.id;
  db.attachment.get( image_id, 'image', function( err1, body1 ){
    res.contentType( 'image/png' );
    res.end( body1, 'binary' );
  });
});

app.delete( '/image', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var id = req.query.id;

  //. Cloudant から削除
  db.get( id, null, function( err2, body2, header2 ){
    if( err2 ){
      err2.image_id = "error-2";
      res.write( JSON.stringify( { status: false, error: err2 } ) );
      res.end();
    }

    var rev = body2._rev;
    db.destroy( id, rev, function( err3, body3, header3 ){
      if( err3 ){
        err3.image_id = "error-3";
        res.write( JSON.stringify( { status: false, error: err3 } ) );
        res.end();
      }

      body3.image_id = id;
      res.write( JSON.stringify( { status: true, body: body3 } ) );
      res.end();
    });
  });
});

app.get( '/reset', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( db && settings.admin_username && settings.admin_password ){
    var username = req.query.username;
    var password = req.query.password;
    if( username == settings.admin_username && password == settings.admin_password ){
      cloudant.db.destroy( settings.db_name, function( err, body ){
        if( err ){
          db = cloudant.db.use( settings.db_name );
          res.status( 400 );
          res.write( JSON.stringify( { status: false, message: "failed to destroy." }, 2, null ) );
          res.end();
        }else{
          cloudant.db.create( settings.db_name, function( err, body ){
            if( err ){
              db = null;
              res.status( 400 );
              res.write( JSON.stringify( { status: false, message: "failed to recreate." }, 2, null ) );
              res.end();
            }else{
              db = cloudant.db.use( settings.db_name );
              res.write( JSON.stringify( { status: true, message: body }, 2, null ) );
              res.end();
            }
          });
        }
      });
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: "username and/or password not mached." }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: "no username and/or password not set on settings.js" }, 2, null ) );
    res.end();
  }
});

app.get( '/images', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var limit = req.query.limit ? parseInt( req.query.limit ) : 0;
  var offset = req.query.offset ? parseInt( req.query.offset ) : 0;

  if( db ){
    db.list( { include_docs: true }, function( err, body ){
      if( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
        res.end();
      }else{
        var total = body.total_rows;
        var images = [];
        body.rows.forEach( function( doc ){
          var _doc = JSON.parse(JSON.stringify(doc.doc));
          if( _doc._id.indexOf( '_' ) !== 0 ){
            images.push( _doc );
          }
        });

        if( offset || limit ){
          if( offset + limit > total ){
            images = images.slice( offset );
          }else{
            images = images.slice( offset, offset + limit );
          }
        }

        var result = { status: true, total: total, limit: limit, offset: offset, images: images };
        res.write( JSON.stringify( result, 2, null ) );
        res.end();
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});


function timestamp2datetime( ts ){
  if( ts ){
    var dt = new Date( ts );
    var yyyy = dt.getFullYear();
    var mm = dt.getMonth() + 1;
    var dd = dt.getDate();
    var hh = dt.getHours();
    var nn = dt.getMinutes();
    var ss = dt.getSeconds();
    var datetime = yyyy + '-' + ( mm < 10 ? '0' : '' ) + mm + '-' + ( dd < 10 ? '0' : '' ) + dd
      + ' ' + ( hh < 10 ? '0' : '' ) + hh + ':' + ( nn < 10 ? '0' : '' ) + nn + ':' + ( ss < 10 ? '0' : '' ) + ss;
    return datetime;
  }else{
    return "";
  }
}


app.listen( appEnv.port );
console.log( "server stating on " + appEnv.port + " ..." );
