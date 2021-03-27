const fs = require('fs');
const {exec} = require('child_process');
const {series, watch, src, dest, parallel} = require('gulp');
const glob = require('glob');
const pump = require('pump');

const beeper = require('beeper');
const del = require('del');
const filter = require('gulp-filter');
const livereload = require('gulp-livereload');
const rename = require('gulp-rename');

const uglify = require('gulp-uglify');

const sass = require('gulp-sass');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');

const zip = require('gulp-zip');

sass.compiler = require('node-sass');

function serve(done) {
    livereload.listen();
    done();
}

const handleError = (done) => {
    return function (err) {
        if (err) {
            beeper();
        }
        return done(err);
    };
};

function icons(done) {
    const re = RegExp(/\{\{>\s*(['"])icons\/(.*?)\1\}\}/, 'gm');

    del('partials/icons/*.hbs');

    glob('{,partials/**/}*.hbs', (err, files) => {
        const icons = [];
        for (const file of files) {
            if (file.startsWith('partials/icons')) { continue; }
            let match;
            while ((match = re.exec(fs.readFileSync(file, 'utf8'))) != null) {
                if (icons.indexOf(match[2]) < 0) {
                    icons.push(match[2]);
                }
            }
        }
        pump([
            src(icons.map(iconName => `node_modules/feather-icons/dist/icons/${iconName}.svg`)),
            rename({ extname: ".hbs" }),
            dest('partials/icons/')
        ], handleError(done));
    });
}

function hbs(done) {
    pump([
        src(['*.hbs', 'partials/**/*.hbs', '!node_modules/**/*.hbs']),
        livereload()
    ], handleError(done));
}

function fonts(done) {
    pump([
        src('assets/fonts/*.ttf'),
        dest('assets/built/fonts/'),
        livereload()
    ], handleError(done));
}

function css(done) {
    pump([
        src('assets/css/*.scss', {sourcemaps: true}),
        sass(),
        postcss([autoprefixer()]),
        filter(['assets/css/style.css']),
        dest('assets/built/', {sourcemaps: '.'}),
        livereload()
    ], handleError(done));
}

function js(done) {
    pump([
        src('assets/js/*.js', {sourcemaps: true}),
        uglify(),
        dest('assets/built/', {sourcemaps: '.'}),
        livereload()
    ], handleError(done));
}

function zipper(done) {
    var targetDir = 'dist/';
    var themeName = require('./package.json').name;
    var filename = themeName + '.zip';

    pump([
        src([
            '**',
            '!node_modules', '!node_modules/**',
            '!dist', '!dist/**'
        ]),
        zip(filename),
        dest(targetDir)
    ], handleError(done));
}

const cssWatcher = () => watch('assets/css/**', css);
const fullHbs = series(icons, hbs);
const hbsWatcher = () => watch(['*.hbs', 'partials/**/*.hbs',
                                '!partials/icons/*.hbs',
                                '!node_modules/**/*.hbs'], fullHbs);
const watcher = parallel(cssWatcher, hbsWatcher);
const build = series(icons, fonts, css, js);
const dev = series(build, serve, watcher);

exports.build = build;
exports.zip = series(build, zipper);
exports.fonts = (done) => {
    const dir = fs.mkdtempSync("nunito-");
    if (dir) {
        exec(`git clone https://github.com/googlefonts/nunito.git ${dir}`, (error) => {
            if (error == null) {
                const fonts = ['Bold', 'Light', 'Regular', 'SemiBold'];
                for (let font of fonts) {
                    fs.copyFileSync(`${dir}/fonts/TTF/Nunito-${font}.ttf`,
                                    `assets/fonts/Nunito-${font}.ttf`);
                }
                done();
            }
            fs.rmSync(dir, { force: true, recursive: true });
        });
    }
}
exports.default = dev;
