/**
 * Created by ZZYZX on 05/03/2017.
 * This file defines the syntax that's supported.
 */

/**
 * onStart and onEnd should return HTML markup for this tag.
 * location is an object that contains two fields: start and end, both ints that point to the initial source file.
 */

const Syntax =
    [
        {
            id: 'bold',
            start: '**',
            end: '**',

            onStart: function(matches, location) {

            },

            onEnd: function(matches, location) {

            }
        },
        {
            id: 'paragraph',
            start: /^([^\n]*)(\n|$)/,
            end: /(\n|$)/,

            onStart: function(matches, location) {
                return '<p>';
            },

            onEnd: function(matches, location) {
                return '</p>';
            }
        }
    ];