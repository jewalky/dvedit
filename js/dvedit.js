DVEdit = {
    
    init: function()
    {
        this.SourceControl = document.querySelector('.dv-sourcecode');
        this.Control = document.querySelector('.dv-visualframe');
        
        //
        this.SourceControl.addEventListener('input', function(e){return DVEdit.sourceInputChanged();});
        this.Control.addEventListener('keypress', function(e){return DVEdit.visualKeyPress(e);});
        this.Control.addEventListener('keydown', function(e){return DVEdit.visualKeyDown(e);});
        this.Control.addEventListener('keyup', function(e){return DVEdit.visualKeyUp(e);});
        document.addEventListener('selectionchange', function(e) { return DVEdit.selectionChanged(e); });
        
        //
        this.sourceInputChanged();
        this.setHandleSelection(true);
    },
    
    handleSelection: false,
    setHandleSelection: function(handle)
    {
        this.handleSelection = handle;
    },
    
    lastOffset: -1,
    lastNode: void 0,
    selectionChanged: function(e)
    {
        if (!this.handleSelection)
            return;
        
        //return; // todo fix
        
        function checkParentDVType(node, type)
        {
            var p = node;
            while (p)
            {
                if (p.getAttribute && p.getAttribute('dv-type')===type)
                    return true;
                p = p.parentNode;
            }
            
            return false;
        }
        
        function findPrevTextSibling(node)
        {
            function findLastTextNode(node)
            {
                if (node.nodeType === Node.TEXT_NODE && checkParentDVType(node, 'base'))
                    return node;
                var s = node.lastChild;
                while (s)
                {
                    var o = findLastTextNode(s);
                    if (o) return o;
                    s = s.previousSibling;
                }
                return void 0;
            }
            
            var p = node;
            while (p && p != DVEdit.Control)
            {
                var s = p.previousSibling;
                while (s)
                {
                    var o = findLastTextNode(s);
                    if (o) return o;
                    s = s.previousSibling;
                }
                
                p = p.parentNode;
            }
            
            return void 0;
        }
        
        function findNextTextSibling(node)
        {
            function findFirstTextNode(node)
            {
                if (node.nodeType === Node.TEXT_NODE && checkParentDVType(node, 'base'))
                    return node;
                var s = node.firstChild;
                while (s)
                {
                    var o = findFirstTextNode(s);
                    if (o) return o;
                    s = s.nextSibling;
                }
                return void 0;
            }

            
            var p = node;
            while (p && p != DVEdit.Control)
            {
                var s = p.nextSibling;
                while (s)
                {
                    var o = findFirstTextNode(s);
                    if (o) return o;
                    s = s.nextSibling;
                }
                
                p = p.parentNode;
            }
            
            return void 0;
        }
        
        var selection = this.getSelection();
        var selectionNull = (selection.focusNode.nodeValue === '\u200b');
        
        var offset = selection.focusOffset;
        
        if (selectionNull)
        {
            if (offset === 1)
            {
                if (this.lastNode === selection.focusNode && this.lastOffset === 0)
                {
                    this.setHandleSelection(false);
                    var nextSibling = findNextTextSibling(selection.focusNode);
                    if (nextSibling)
                    {
                        var deflated = selection.focusNode === selection.anchorNode && selection.focusOffset === selection.anchorOffset;
                        selection.focusNode = nextSibling;
                        selection.focusOffset = 0;
                        if (deflated)
                        {
                            selection.anchorNode = nextSibling;
                            selection.anchorOffset = 0;
                        }
                    }
                    this.setSelection(selection);
                    this.setHandleSelection(true);
                }
                else
                {
                    this.setHandleSelection(false);
                    selection.focusOffset = 0;
                    this.setSelection(selection);
                    this.setHandleSelection(true);
                }
                
                this.lastNode = selection.focusNode;
                this.lastOffset = selection.focusOffset;
            }
        }
        
        this.selectionLastOffset = offset;
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
            if (!xNode.getAttribute)
                continue;
            var dvData = Parser_GetDVAttrsFromNode(xNode);
            if (dvData.type === 'base' && !xNode.lastChild)
            {
                // insert empty text. this is only visual!
                var textNode = document.createTextNode('\u200b');
                xNode.appendChild(textNode);
            }
            else if (dvData.cstart === void 0 || dvData.cend === void 0)
            {
                var xNode1 = xNode.nextSibling;
                if (xNode1 && xNode1.getAttribute)
                {
                    var dvData1 = Parser_GetDVAttrsFromNode(xNode1);
                    if (dvData1.cstart === void 0 || dvData1.cend === void 0)
                    {
                        // insert empty span.
                        var span = document.createElement('span');
                        span.setAttribute('dv-type', 'base');
                        span.setAttribute('dv-start', dvData.end);
                        span.setAttribute('dv-end', dvData1.start);
                        span.setAttribute('dv-cstart', dvData.end);
                        span.setAttribute('dv-cend', dvData1.start);
                        span.textContent = '\u200b';
                        xNode1.parentNode.insertBefore(span, xNode1);
                    }
                }
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
                var selection = this.getSelection();
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
                    // note: if we have a content-less element, we may safely delete it.
                    if (selection.anchorNode.parentNode.previousSibling)
                    {
                        var dvData = Parser_GetDVAttrsFromNode(selection.anchorNode.parentNode.previousSibling);
                        if (dvData.type !== void 0 && dvData.cstart === void 0 && dvData.cend === void 0)
                        {
                            //
                            this.removeSource(dvData.start, dvData.end);
                        }
                    }
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
                var selection = this.getSelection();
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
                    // note: if we have a content-less element, we may safely delete it.
                    if (selection.anchorNode.parentNode.nextSibling)
                    {
                        var dvData = Parser_GetDVAttrsFromNode(selection.anchorNode.parentNode.nextSibling);
                        if (dvData.type !== void 0 && dvData.cstart === void 0 && dvData.cend === void 0)
                        {
                            //
                            this.removeSource(dvData.start, dvData.end);
                        }
                    }
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
        var selection = this.getSelection();
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
    
    getSelection: function()
    {
        var selection = window.getSelection();
        return { focusNode: selection.focusNode, focusOffset: selection.focusOffset, 
                 anchorNode: selection.anchorNode, anchorOffset: selection.anchorOffset };
    },
    
    setSelection: function(sel, noset)
    {
        var range = document.createRange();
        range.setStart(sel.anchorNode, sel.anchorOffset);
        range.setEnd(sel.focusNode, sel.focusOffset);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    },
    
    setCursorToSource: function(index)
    {
        var selection = this.getSelection();
        var dvSel = this.getDVNodeBySource(index);
        if (!dvSel) return;
        
        var dvData = Parser_GetDVAttrsFromNode(dvSel);
        if (dvSel.firstChild)
        {
            selection.focusNode = selection.anchorNode = dvSel.firstChild;
            selection.focusOffset = selection.anchorOffset = index-dvData.cstart;
        }
        else
        {
            selection.focusNode = selection.anchorNode = dvSel;
            selection.focusOffset = selection.anchorOffset = 0;
        }
        this.setSelection(selection);
    },
    
    // removes source code from start to end (exclusive)
    removeSource: function(start, end)
    {
        if (this.isMultiSelection())
            return; // don't insert anything like this.
        
        // insert character.
        // extremely special case.
        if (this.SourceControl.value.length)
        {
            var selection = this.getSelection();
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
        this.setHandleSelection(false);
        var currentSource = this.SourceControl.value;
        currentSource = currentSource.substr(0, start)+currentSource.substr(end);
        this.SourceControl.value = currentSource;
        this.sourceInputChanged();
        this.setHandleSelection(true);
        
        if (cursorPosition >= start && cursorPosition < end)
            this.setCursorToSource(start);
        else if (cursorPosition >= end)
            this.setCursorToSource(cursorPosition-(end-start));
    },
    
    // inserts character/string at the current cursor position.
    insertSource: function(ch)
    {
        if (this.isMultiSelection())
            return; // don't insert anything like this.
        
        // insert character.
        // extremely special case.
        if (this.SourceControl.value.length)
        {
            var selection = this.getSelection();
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
        this.setHandleSelection(false);
        var currentSource = this.SourceControl.value;
        currentSource = currentSource.substr(0, cursorPosition)+ch+currentSource.substr(cursorPosition);
        this.SourceControl.value = currentSource;
        this.sourceInputChanged();
        this.setHandleSelection(true);
        
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