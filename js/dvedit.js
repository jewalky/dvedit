DVEdit = {
    
    init: function()
    {
        this.SourceControl = document.querySelector('.dv-sourcecode');
        this.Control = document.querySelector('.dv-visualframe');
        
        //
        this.SourceControl.addEventListener('input', this.sourceInputChanged);
        this.Control.addEventListener('keypress', this.visualKeyPress);
        this.Control.addEventListener('keydown', this.visualKeyDown);
        this.Control.addEventListener('keyup', this.visualKeyUp);
        
        //
        this.sourceInputChanged();
    },
    
    sourceInputChanged: function()
    {
        var sStart = DVEdit.SourceControl.selectionStart;
        var sEnd = DVEdit.SourceControl.selectionEnd;
        var newSource = DVEdit.SourceControl.value || '';
        DVEdit.SourceControl.value = newSource;
        DVEdit.SourceControl.selectionStart = sStart;
        DVEdit.SourceControl.selectionEnd = sEnd;
        
        var parsed = Parse(DVEdit.SourceControl.value);
        DVEdit.Control.innerHTML = parsed;
        
        // fix some things for editing.
        var xSearch = document.evaluate('.//*', DVEdit.Control, null, XPathResult.ANY_TYPE, null);
        var xNode = void 0;
        var xNodes = [];
        while (xNode = xSearch.iterateNext())
            xNodes.push(xNode); // iterator will fail if the DOM changes. so first collect, then change.
        for (var i = 0; i < xNodes.length; i++)
        {
            xNode = xNodes[i];
            if (xNode.tagName === 'SPAN' && !xNode.lastChild)
            {
                //console.log(xNode);
                // insert empty text
                var textNode = document.createTextNode('\u200b');
                xNode.appendChild(textNode);
            }
        }

    },
    
    visualKeyPress: function(e)
    {
        var ch = String.fromCharCode(e.which);
        DVEdit.insertSource(ch);
        
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
                DVEdit.insertSource('\\\\ ');
            }
            else 
            {
                DVEdit.insertSource('\n');
            }
        }
        else if (e.keyCode === 8) // backspace
        {
            // do nothing for now
        }
        else if (e.keyCode == 46) // delete
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
    
    // inserts character at the current cursor position.
    insertSource: function(ch)
    {
        // insert character.
        // extremely special case.
        if (DVEdit.SourceControl.value.length)
        {
            var selection = window.getSelection();
            // find first element with dv-type.
            var dvSel = DVEdit.getFirstDVParent(selection.focusNode);
            var dvData = Parser_GetDVAttrsFromNode(dvSel);
            var cursorPosition = selection.focusOffset+dvData.cstart;
        }
        else
        {
            var dvSel = DVEdit.Control.querySelector('p');
            var dvData = Parser_GetDVAttrsFromNode(dvSel);
            var cursorPosition = 0;
        }
        
        // insert character in the source code.
        var currentSource = DVEdit.SourceControl.value;
        currentSource = currentSource.substr(0, cursorPosition)+ch+currentSource.substr(cursorPosition);
        DVEdit.SourceControl.value = currentSource;
        DVEdit.sourceInputChanged();
        
        cursorPosition+=ch.length;
        
        selection = window.getSelection();
        var range = document.createRange();
        dvSel = DVEdit.getDVNodeBySource(cursorPosition);
        if (!dvSel) return;
        
        dvData = Parser_GetDVAttrsFromNode(dvSel);
        console.log(dvData, dvSel);
        if (dvSel.firstChild)
        {
            range.setStart(dvSel.firstChild, cursorPosition-dvData.cstart);
            range.setEnd(dvSel.firstChild, cursorPosition-dvData.cstart);
        }
        else
        {
            range.setStart(dvSel, 0);
            range.setEnd(dvSel, 0);
        }
        selection.removeAllRanges();
        selection.addRange(range);
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
        console.log(form_main.childNodes);
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