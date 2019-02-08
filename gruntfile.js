module.exports = function(grunt) {
  grunt.initConfig({
    jshint: {
      files: ['*.js'],
      options: {
        globals: {
          jQuery: true
        }
      }
    },
	nodemon: {
	  dev: {
		script: 'CSVServer.js',
        ignore:  ['node_modules/**']
	  }
	},
    watch: {
	  scripts: {
		files: ['<%= jshint.files %>'],
		tasks: ['jshint']
	  }
    },
	concurrent: {
      dev: {
        tasks: ['nodemon', 'watch'],
        options: {
            logConcurrentOutput: true
        }
      }
	}
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-nodemon');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-concurrent');

  grunt.registerTask('default', ['concurrent']);
  /*grunt.registerTask('default', '', function() {
    var taskList = [
        'jshint',
		'nodemon',
		'watch'
    ];
    grunt.task.run(taskList);
  });*/
};