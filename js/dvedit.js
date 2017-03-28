DVEdit = {
    
    init: function()
    {
        this.SourceControl = document.querySelector('.dv-sourcecode');
        this.Control = document.querySelector('.dv-visualframe');
        
        //
        this.SourceControl.addEventListener('input', function(e){return DVEdit.sourceInputChanged(e);});
        this.Control.addEventListener('keypress', function(e){return DVEdit.visualKeyPress(e);});
        this.Control.addEventListener('keydown', function(e){return DVEdit.visualKeyDown(e);});
        this.Control.addEventListener('keyup', function(e){return DVEdit.visualKeyUp(e);});
        
        //
        this.sourceInputChanged();
    },
    
    sourceInputChanged: function()
    {
        var sStart = this.SourceControl.selectionStart;
        var sEnd = this.SourceControl.selectionEnd;
        var newSource = this.SourceControl.value || '';
        this.SourceControl.value = newSource;
        this.SourceControl.selectionStart = sStart;
        this.SourceControl.selectionEnd = sEnd;
        
        var parsed = Parse(this.SourceControl.value);
        this.Control.innerHTML = parsed;
        
        // fix some things for editing.
        var xSearch = document.evaluate('.//*', this.Control, null, XPathResult.ANY_TYPE, null);
        var xNode = void 0;
        var xNodes = [];
        while (xNode = xSearch.iterateNext())
            xNodes.push(xNode); // iterator will fail if the DOM changes. so first collect, then change.
        for (var i = 0; i < xNodes.length; i++)
        {
            xNode = xNodes[i];
            if (xNode.tagName === 'SPAN' && !xNode.lastChild)
            {
                // insert empty text. this is only visual!
                var textNode = document.createTextNode('\u200b');
                xNode.appendChild(textNode);
            }
        }

    },
    
    visualKeyPress: function(e)
    {
        var ch = String.fromCharCode(e.which);
        this.insertSource(ch);
        
        //
        e.preventDefault();
        return false;
    },
    
    visualKeyDown: function(e)
    {
        // enter key
        if (e.keyCode === 13)
        {
            if (e.shiftKey)
            {
                this.insertSource('\\\\ ');
            }
            else 
            {
                this.insertSource('\n');
            }
        }
        else if (e.keyCode === 8) // backspace
        {
            if (this.isMultiSelection())
            {
                // do nothing for now
            }
            else
            {
                // delete before selection.
                var selection = window.getSelection();
                if (selection.anchorOffset > 0 && selection.anchorNode.textContent != '\u200b')
                {
                    // delete one character before.
                    // find first element with dv-type.
                    var dvSel = this.getFirstDVParent(selection.focusNode);
                    var dvData = Parser_GetDVAttrsFromNode(dvSel);
                    var cursorPosition = selection.focusOffset+dvData.cstart;
                    
                    var currentSource = this.SourceControl.value;
                    currentSource = currentSource.substr(0, cursorPosition-1)+currentSource.substr(cursorPosition);
                    this.SourceControl.value = currentSource;
                    this.sourceInputChanged();
                    
                    this.setCursorToSource(cursorPosition-1);
                }
                else
                {
                    // we need to merge the current node with the previous one.
                    // this needs checking with the parser. might not be possible (e.g. if we're in a table)
                }
            }
        }
        else if (e.keyCode == 46) // delete
        {
            if (this.isMultiSelection())
            {
                // do nothing for now
            }
            else
            {
                // delete after selection.
                var selection = window.getSelection();
                console.log(selection.anchorNode.textContent.length);
                console.log(selection.anchorOffset);
                if (selection.anchorOffset < selection.anchorNode.textContent.length && selection.anchorNode.textContent != '\u200b')
                {
                    // delete one character after.
                    // find first element with dv-type.
                    var dvSel = this.getFirstDVParent(selection.focusNode);
                    var dvData = Parser_GetDVAttrsFromNode(dvSel);
                    var cursorPosition = selection.focusOffset+dvData.cstart;
                    
                    var currentSource = this.SourceControl.value;
                    currentSource = currentSource.substr(0, cursorPosition)+currentSource.substr(cursorPosition+1);
                    this.SourceControl.value = currentSource;
                    this.sourceInputChanged();
                    
                    this.setCursorToSource(cursorPosition);
                }
                else
                {
                    // merge with next. same rules as above, needs finishing syntax.js.
                }
            }
        }
        else if (e.ctrlKey) // ctrl+something
        {
            // do nothing for now
        }
        else return true;
        
        //
        e.preventDefault();
        return false;
    },
    
    visualKeyUp: function(e)
    {
        //
        e.preventDefault();
        return false;
    },

    isMultiSelection: function()
    {
        var selection = window.getSelection();
        if (selection.anchorNode != selection.focusNode)
            return true;
        if (selection.anchorOffset != selection.focusOffset)
            return true;
        return false;
    },
    
    // this function retrieves first parent element with dv-type.
    getFirstDVParent: function(base)
    {
        while (base && base != this.Control)
        {
            if (base.getAttribute && base.getAttribute('dv-type') !== void 0)
                return base;
            base = base.parentNode;
        }
        
        return void 0;
    },
    
    // this function retrieves all parents with dv-type until control.
    getAllDVParents: function(base)
    {
        var list = [];
        while (base && base != this.Control)
        {
            if (base.getAttribute && base.getAttribute('dv-type') !== void 0)
                list.push(base);
            base = base.parentNode;
        }
        
        return list;
    },
    
    // this retrieves DV node by source location
    getDVNodeBySource: function(index)
    {
        var xSearch = document.evaluate('.//*[@dv-type and @dv-cstart and @dv-cend and not(.//*[@dv-type])]', this.Control, null, XPathResult.ANY_TYPE, null);
        var xNode = void 0;
        var xMin = 0;
        var xMax = 2147483647;
        var xOutNode = void 0;

        while (xNode = xSearch.iterateNext())
        {
            var attrs = Parser_GetDVAttrsFromNode(xNode);
            if (attrs.cstart === void 0 || attrs.cend === void 0) // not editable element
                continue;
            if (attrs.cstart > index || attrs.cend < index)
                continue;
            
            if (attrs.cstart === index && attrs.cend === index)
                return xNode;
            
            if (attrs.cstart > xMin || attrs.cend < xMax)
            {
                xMin = attrs.cstart;
                xMax = attrs.cend;
                xOutNode = xNode;
            }
        }
        
        return xOutNode;
    },
    
    setCursorToSource: function(index)
    {
        var selection = window.getSelection();
        var range = document.createRange();
        var dvSel = this.getDVNodeBySource(index);
        if (!dvSel) return;
        
        var dvData = Parser_GetDVAttrsFromNode(dvSel);
        if (dvSel.firstChild)
        {
            range.setStart(dvSel.firstChild, index-dvData.cstart);
            range.setEnd(dvSel.firstChild, index-dvData.cstart);
        }
        else
        {
            range.setStart(dvSel, 0);
            range.setEnd(dvSel, 0);
        }
        selection.removeAllRanges();
        selection.addRange(range);
    },
    
    // inserts character at the current cursor position.
    insertSource: function(ch)
    {
        if (this.isMultiSelection())
            return; // don't insert anything like this.
        
        // insert character.
        // extremely special case.
        if (this.SourceControl.value.length)
        {
            var selection = window.getSelection();
            // find first element with dv-type.
            var dvSel = this.getFirstDVParent(selection.focusNode);
            var dvData = Parser_GetDVAttrsFromNode(dvSel);
            var cursorPosition = selection.focusOffset+dvData.cstart;
        }
        else
        {
            var dvSel = this.Control.querySelector('p');
            var dvData = Parser_GetDVAttrsFromNode(dvSel);
            var cursorPosition = 0;
        }
        
        // insert character in the source code.
        var currentSource = this.SourceControl.value;
        currentSource = currentSource.substr(0, cursorPosition)+ch+currentSource.substr(cursorPosition);
        this.SourceControl.value = currentSource;
        this.sourceInputChanged();
        
        cursorPosition+=ch.length;
        
        this.setCursorToSource(cursorPosition);
    },
    
    // static form send, to avoid using ajax all over.
    _staticFormSubmit: function(url, args)
    {
        if (args === void 0)
        {
            window.location.href = url;
            return;
        }
        
        var form_main = document.createElement('form');
        form_main.setAttribute('method', 'POST');
        form_main.setAttribute('action', url);
        var args_keys = Object.keys(args);
        args_keys.forEach(function(arg)
        {
            var argv = args[arg];
            // check if it's an array. translate to multiple field[]=value inputs.
            if (Object.prototype.toString.call(argv) === '[object Array]')
            {
                var argx = arg+'[]';
                argv.forEach(function(val)
                {
                    var form_field = document.createElement('input');
                    form_field.setAttribute('type', 'hidden');
                    form_field.setAttribute('name', argx);
                    form_field.setAttribute('value', val);
                    form_main.appendChild(form_field);
                });
            }
            else
            {
                var form_field = document.createElement('input');
                form_field.setAttribute('type', 'hidden');
                form_field.setAttribute('name', arg);
                form_field.setAttribute('value', argv);
                form_main.appendChild(form_field);
            }
        });
        
        // work around firefox bug (or normal behavior?)
        form_main.innerHTML += '<input type="submit" value="Click me" />';
        form_main.style.display = 'none';
        document.body.appendChild(form_main);
        form_main.submit();
    },
    
    save: function()
    {
        
    }
    
};

window.addEventListener('load', function()
{
    DVEdit.init();
});