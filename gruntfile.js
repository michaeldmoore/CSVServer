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
        options: {
          //args: [/*'--csvfolder', 'csv',*/ '--dateformat', 'DD/MM/YYYY HH:mm:ss'],
          ignore: ['node_modules/**'],
        }
      },
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
  grunt.loadNpmTasks('grunt-js-test');
  grunt.loadNpmTasks('grunt-concurrent');

  grunt.registerTask('default', ['concurrent']);
 };