<?php
    
    if (!defined('DOKU_INC'))
        define('DOKU_INC', realpath(dirname(__FILE__) . '/../../../') . '/');
    if (!defined('DOKU_PLUGIN'))
        define('DOKU_PLUGIN', DOKU_INC . 'lib/plugins/');
    require_once(DOKU_PLUGIN . 'action.php');
    
    class action_plugin_dvedit_edit extends DokuWiki_Action_Plugin
    {
        function register(Doku_Event_Handler $controller)
        {
            // found in ckgedit
            $controller->register_hook('COMMON_PAGE_FROMTEMPLATE', 'AFTER', $this, 'pagefromtemplate', array());
            $controller->register_hook('COMMON_PAGETPL_LOAD', 'AFTER', $this, 'pagefromtemplate', array());
        
            $controller->register_hook('TPL_ACT_RENDER', 'BEFORE', $this, 'dvedit_render');
            $controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'dvedit_meta');
        }
        
        function pagefromtemplate(Doku_Event $event)
        {
            if ($event->data['tpl'])
            {
                $this->page_from_template = $event->data['tpl'];
            }
        }
        
        function dvedit_meta(Doku_Event $event)
        {
            global $ACT;
            // we only change the edit behaviour
            if ($ACT != 'edit') {
                return;
            }
            
            /*
            global $ID;
            global $REV;
            global $INFO;
            
            $event->data['script'][] = array(
                'type' => 'text/javascript',
                'charset' => 'utf-8',
                '_data' => '',
                'src' => DOKU_BASE . 'lib/plugins/ckgedit/' . $this->fck_location . '/ckeditor.js'
            );
            
            $ua = strtolower($_SERVER['HTTP_USER_AGENT']);
            if (strpos($ua, 'msie') !== false) {
                echo "\n" . '<meta http-equiv="X-UA-Compatible" content="IE=EmulateIE8" />' . "\n";
            }*/
            
            $scripts = array('lexer', 'syntax', 'parser', 'dvedit');
            
            foreach ($scripts as $script)
            {
                $event->data['script'][] = array(
                    'type' => 'text/javascript',
                    'charset' => 'utf-8',
                    'src' => DOKU_BASE . 'lib/plugins/dvedit/js/' . $script . '.js'
                );
            }
            
            return;
        }

        function dvedit_render(Doku_Event $event)
        {
            
            global $INFO;
            
            // we only change the edit behaviour
            if ($event->data != 'edit') {
                return;
            }
            
            if (isset($_GET['editor']))
            {
                $editor = $_GET['editor']==='dv'?'dv':'dw';
                setcookie('dv-editor', $editor);
            }
            else if (isset($_COOKIE['editor']))
            {
                $editor = $_COOKIE['editor']==='dv'?'dv':'dw';
            }
            else $editor = 'dw';
            
            if ($editor === 'dw')
                unset($_GET['editor']);
            
            // the switch
            ?>
                <div class="dv-switcher">
                    <a href="?id=<?php echo $_GET['id']; ?>&do=edit&editor=dw" class="<?php echo ($editor==='dw')?'current':''; ?>">DokuWiki</a><a href="?id=<?php echo $_GET['id']; ?>&do=edit&editor=dv" class="<?php echo ($editor==='dv')?'current':''; ?>">DokuVisual</a>
                </div>
            <?php
            
            if ($editor === 'dv')
            {
                $event->preventDefault();
                $event->stopPropagation();
                $this->render();
            }
            else
            {
                // this means use default editor. do nothing here.
            }
        }
        
        function render()
        {
            global $ID;
            global $REV;
            global $DATE;
            global $RANGE;
            global $PRE;
            global $SUF;
            global $INFO;
            global $SUM;
            global $lang;
            global $conf;
            global $ckgedit_lang;
            //set summary default
            if (!$SUM)
            {
                if ($REV)
                {
                    $SUM = $lang['restored'];
                }
                else if (!$INFO['exists'])
                {
                    $SUM = $lang['created'];
                }
            }
            if ($INFO['exists'])
            {
                if ($RANGE)
                {
                    list($PRE, $text, $SUF) = rawWikiSlices($RANGE, $ID, $REV);
                }
                else 
                {
                    $text = rawWiki($ID, $REV);
                }
            }
            else
            {
                //try to load a pagetemplate
                $text = pageTemplate($ID);
                //Check for text from template event handler
                if (!$text && $this->page_from_template)
                    $text = $this->page_from_template;
            }
            
            ?>
            <h4>Source code (for debugging)</h4>
            <textarea class="dv-sourcecode"><?php echo $text; ?></textarea>
            <hr>
            <h4>Editor</h4>
            <div class="dv-visualframe" contenteditable="true"></div>
            <?php
        }

    }
    
?>