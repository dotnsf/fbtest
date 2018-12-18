exports.db_username = '';
exports.db_password = '';
exports.db_name = 'doodledb';

exports.admin_username = 'username';
exports.admin_password = 'password';

exports.app_port = 0;

exports.base_url = '';

exports.fb_app_id = '';
exports.fb_app_secret = '';
exports.fb_access_token = '';

if( process.env.VCAP_SERVICES ){
  var VCAP_SERVICES = JSON.parse( process.env.VCAP_SERVICES );
  if( VCAP_SERVICES && VCAP_SERVICES.cloudantNoSQLDB ){
    exports.db_username = VCAP_SERVICES.cloudantNoSQLDB[0].credentials.username;
    exports.db_password = VCAP_SERVICES.cloudantNoSQLDB[0].credentials.password;
  }
}

