module.exports = function(grunt) {
	grunt.initConfig({
		nodemon: {
			all: {
				script: 'CSVServer.js',
				options: {
					watchedExtensions: ['js']
				}
			}			
		}		
	});
	
	grunt.loadNpmTasks('grunt-nodemon');
	
	grunt.registerTask('default', 'nodemon');
};