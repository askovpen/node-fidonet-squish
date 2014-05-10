var gulp = require('gulp');
var replace = require('gulp-replace');
var jshint = require('gulp-jshint');
var rename = require('gulp-rename');
var exec = require('child_process').exec;
var js=['./package.json',
	'./gulpfile.js',
	'./fido-squish.js',
	'./test/test.js'
	];
gulp.task('version', function(done){
	exec('/usr/bin/git rev-list HEAD --count', function(err, stdout, stderr){
		vers='0.0.'+stdout.replace(/(\r\n|\n|\r)/gm,"");
		console.log('[version] '+vers);
		done();
	});
});
gulp.task('replace',['version'], function() {
	gulp.src('package.json.tpl')
		.pipe(replace('@@ver', vers))
		.pipe(rename('package.json'))
		.pipe(gulp.dest('./'));
});
gulp.task('lint',['replace'], function() {
	return gulp.src(js)
		.pipe(jshint.reporter('jshint-stylish'))
		.pipe(jshint.reporter('fail'))
});
gulp.task('default', ['lint']);