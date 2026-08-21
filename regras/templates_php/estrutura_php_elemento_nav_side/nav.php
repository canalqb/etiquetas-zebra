<?php
// navigation.php - Versão Melhorada

// Evita warnings caso alguma variável não exista
$usuarioLogado = $usuarioLogado ?? false;
$canal_id = $canal_id ?? null;
$canal_nome = $canal_nome ?? null;
$canal_imgP = $canal_imgP ?? null;
?>



<div class="cqb-nav">
    <?php if ($usuarioLogado && !empty($protecaoValidada)): ?>
        <?php
        // Buscar saldo total para exibir na sidebar
        $stmt_pts_total = $link->prepare("SELECT SUM(vtipoponto) as total FROM pontosdocanal WHERE canal_id = ?");
        $stmt_pts_total->bind_param("s", $canal_id);
        $stmt_pts_total->execute();
        $res_pts_total = $stmt_pts_total->get_result()->fetch_assoc();
        $pontos_totais_sidebar = (int)($res_pts_total['total'] ?? 0);
        $stmt_pts_total->close();
        ?>
        
        <!-- Seção: Pontos Totais -->
        <div class="cqb-points-section">
            <div class="cqb-points-label">💰 Seu Saldo Total</div>
            <div class="cqb-points-value" id="cqb-sidebar-pts-val">
                <i class="fas fa-coins cqb-points-icon" style="color: #ffc107;"></i>
                <span class="pts-number"><?= number_format($pontos_totais_sidebar, 0, ',', '.') ?></span>
            </div>
            <a href="#" onclick="carregar2('./pages/extrato.php'); return false;" class="cqb-points-link">
                <i class="fas fa-chart-line"></i> Ver Extrato Detalhado
            </a>
        </div>

        <!-- Seção: Link de Referência -->
        <div class="cqb-referral-container">
            <div class="cqb-referral-title">
                <i class="fas fa-link"></i>
                <span>Link de Indicação</span>
            </div>
            <div class="cqb-referral-wrapper">
                <?php $ref_link = "https://canalqb.infinityfree.me/?r=" . ($canal_id ?? ''); ?>
                <span class="cqb-referral-link" id="cqb-ref-text"><?= $ref_link ?></span>
                <button class="cqb-referral-copy-btn" onclick="copiarLinkRef(this, '<?= $ref_link ?>')">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
            <p class="cqb-referral-info">
                <i class="fas fa-gift" style="color: #28a745; margin-right: 4px;"></i>
                <strong>+10 pontos</strong> por cada novo usuário!
            </p>
        </div>

        <script>
            function copiarLinkRef(btn, link) {
                navigator.clipboard.writeText(link).then(() => {
                    const icon = btn.querySelector('i');
                    const original = icon.className;
                    icon.className = 'fas fa-check';
                    btn.style.background = 'linear-gradient(135deg, #20c997 0%, #17a2b8 100%)';
                    
                    setTimeout(() => {
                        icon.className = original;
                        btn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                    }, 2000);
                }).catch(err => {
                    console.error('Erro ao copiar:', err);
                });
            }
        </script>

        <!-- Campo de Busca de Canais -->
        <div class="cqb-search-container">
            <div class="cqb-search-title">
                <i class="fas fa-search"></i>
                <span>Buscar Canal</span>
            </div>
            <div class="cqb-search-wrapper">
                <i class="fas fa-search cqb-search-icon"></i>
                <input type="text" 
                       id="cqb-search-input" 
                       class="cqb-search-input" 
                       placeholder="Digite o nome do canal..."
                       autocomplete="off">
                <button id="cqb-search-clear" class="cqb-search-clear" style="display:none;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>

        <script>
            (function() {
                let searchTimeout;
                const searchInput = document.getElementById('cqb-search-input');
                const searchClear = document.getElementById('cqb-search-clear');

                if (searchInput && searchClear) {
                    searchInput.addEventListener('input', function() {
                        const termo = this.value.trim();
                        searchClear.style.display = termo ? 'flex' : 'none';
                        clearTimeout(searchTimeout);
                        
                        if (termo.length >= 2) {
                            searchTimeout = setTimeout(() => {
                                if (typeof carregar2 === 'function') {
                                    carregar2('./pages/descobrir-canais.php?busca=' + encodeURIComponent(termo));
                                }
                            }, 300);
                        } else if (termo.length === 0) {
                            if (typeof carregar2 === 'function') {
                                carregar2('./pages/descobrir-canais.php');
                            }
                        }
                    });

                    searchClear.addEventListener('click', function() {
                        searchInput.value = '';
                        searchClear.style.display = 'none';
                        searchInput.focus();
                        if (typeof carregar2 === 'function') {
                            carregar2('./pages/descobrir-canais.php');
                        }
                    });
                }
            })();
        </script>

        <div class="cqb-nav-heading">📋 MENU PRINCIPAL</div> 

        <a class="cqb-nav-link" href="#" onclick="carregar2('./pages/descobrir-canais.php'); return false;">
            <i class="fas fa-compass"></i>
            <span>Descobrir Canais</span>
        </a>
    <?php endif; ?>

    <?php
    // Menu dinâmico do banco
    require_once(file_exists('./config/database.php') ? './config/database.php' : (file_exists('./../config/database.php') ? './../config/database.php' : (file_exists('./../../config/database.php') ? './../../config/database.php' : '/../../../config/database.php')));


    if (!isset($protecaoValidada)) {
        $protecaoValidada = false;
        if ($canal_id) {
             $protecaoValidada = !empty($_COOKIE['auth_session']) && $_COOKIE['auth_session'] === hash('sha256', $canal_id . 'salt_seguro_qb');
        }
    }

    $liberadoS = ($usuarioLogado && !empty($protecaoValidada));
    $logadoCondicao = $liberadoS ? "'S','SN'" : "'N','SN'";
    
    $sql = "SELECT id, nome, href, target, onclick, indice, icone 
            FROM menus_main
            WHERE logado IN ($logadoCondicao)
            ORDER BY indice ASC, id ASC";
    $result = $link->query($sql);

    $menus_principais = [];
    $menus_filhos = [];
    $menus_P = [];
    $menus_L = [];

    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $row['target'] = !empty($row['target']) ? $row['target'] : "_self";
            $row['onclick'] = !empty($row['onclick']) ? "onclick=\"{$row['onclick']}; return false;\"" : "";
            $row['href'] = htmlspecialchars($row['href']);

            if ($row['indice'] === '0') {
                $menus_principais[$row['id']] = $row;
                $menus_filhos[$row['id']] = [];
            } elseif ($row['indice'] === 'P') {
                $menus_P[] = $row;
            } elseif ($row['indice'] === 'L') {
                $menus_L[] = $row;
            } else {
                if (!isset($menus_filhos[$row['indice']])) {
                    $menus_filhos[$row['indice']] = [];
                }
                $menus_filhos[$row['indice']][] = $row;
            }
        }
    }

    // Função helper para determinar a classe do ícone (fas ou fab para marcas)
    function getIconClass($icone) {
        $brand_icons = ['fa-whatsapp', 'fa-facebook', 'fa-instagram', 'fa-twitter', 'fa-youtube', 'fa-telegram', 'fa-discord', 'fa-tiktok', 'fa-linkedin'];
        return in_array($icone, $brand_icons) ? 'fab' : 'fas';
    }

    // Renderiza menus principais e submenus
    foreach ($menus_principais as $menu_id => $menu) {
        $has_submenu = !empty($menus_filhos[$menu_id]);
        $menu_class = $has_submenu ? 'has-submenu nav-item' : 'nav-item';

        echo "<div class=\"{$menu_class}\">";

        if ($has_submenu) {
            $icone_menu = !empty($menu['icone']) ? $menu['icone'] : 'fa-folder';
            $icone_class = getIconClass($icone_menu);
            echo "<a class=\"cqb-nav-link\" href=\"#\" onclick=\"this.parentElement.classList.toggle('open'); return false;\">";
            echo "<i class=\"{$icone_class} {$icone_menu}\"></i>";
            echo "<span>" . htmlspecialchars($menu['nome']) . "</span>";
            echo "<i class=\"fas fa-chevron-down\"></i>";
            echo "</a>";

            echo '<div class="cqb-submenu">';
            foreach ($menus_filhos[$menu_id] as $submenu) {
                $icone_sub = !empty($submenu['icone']) ? $submenu['icone'] : 'fa-angle-right';
                $icone_sub_class = getIconClass($icone_sub);
                echo "<a class=\"cqb-submenu-link\" href=\"{$submenu['href']}\" target=\"{$submenu['target']}\" {$submenu['onclick']}>"
                    . "<i class=\"{$icone_sub_class} {$icone_sub}\"></i> " . htmlspecialchars($submenu['nome']) . "</a>";
            }
            echo '</div>';
        } else {
            $icone_menu = !empty($menu['icone']) ? $menu['icone'] : 'fa-folder';
            $icone_class = getIconClass($icone_menu);
            echo "<a class=\"cqb-nav-link\" href=\"{$menu['href']}\" target=\"{$menu['target']}\" {$menu['onclick']}>";
            echo "<i class=\"{$icone_class} {$icone_menu}\"></i>";
            echo "<span>" . htmlspecialchars($menu['nome']) . "</span>";
            echo "</a>";
        }
        echo '</div>';
    }

    if ($menus_P) {
        echo '<div class="cqb-nav-heading">⭐ DESTAQUES</div>';
        foreach ($menus_P as $menu) {
            $icone_menu = !empty($menu['icone']) ? $menu['icone'] : 'fa-star';
            $icone_class = getIconClass($icone_menu);
            echo "<a class=\"cqb-nav-link\" href=\"{$menu['href']}\" target=\"{$menu['target']}\" {$menu['onclick']}>";
            echo "<i class=\"{$icone_class} {$icone_menu}\"></i> <span>" . htmlspecialchars($menu['nome']) . "</span></a>";
        }
    }
    if ($menus_L) {
        echo '<div class="sidebar-divider"></div>';
        foreach ($menus_L as $menu) {
            $icon = !empty($menu['icone']) ? $menu['icone'] : (stripos($menu['nome'], 'sair') !== false ? 'fa-sign-out-alt' : 'fa-sign-in-alt');
            $icone_class = getIconClass($icon);
            echo "<a class=\"cqb-nav-link\" href=\"{$menu['href']}\" target=\"{$menu['target']}\" {$menu['onclick']}>";
            echo "<i class=\"{$icone_class} {$icon}\"></i> <span>" . htmlspecialchars($menu['nome']) . "</span></a>";
        }
    }
    // Espaço extra no final
    echo '<div style="height: 3rem;"></div>';
    echo '
</div>'; // Fecha .cqb-nav
    ?>
	
	
📱 3) Toggle Sidebar (Menu Mobile)

Esse trecho controla o menu lateral no celular.

document.addEventListener('click', (e) => {

Escuta qualquer clique na página.

🔘 Abrir/fechar pelo botão
const toggleBtn = e.target.closest('[data-toggle="sidebar"]');

Verifica se o clique foi em um botão com data-toggle="sidebar".

sidebar.classList.toggle('active');

Adiciona ou remove a classe active (abre ou fecha o menu).

❌ Clique fora do menu
if (!sidebar.contains(e.target)) {
    sidebar.classList.remove('active');
}

Se clicar fora da sidebar, ela fecha.

🔗 Clique em links de navegação
else if (e.target.closest('.cqb-submenu-link, .cqb-nav-link'))

Se clicar em um link:

Fecha a sidebar

Exceto se for um item que abre submenu

Isso evita que o menu feche quando o usuário apenas expande uma categoria.

🌐 4) Função conectar(pagina)
function conectar(pagina)
O que faz:

Carrega uma página dinamicamente dentro do elemento #up.

Como funciona:

Pega o valor do campo idchannel

Pega o valor do campo referencia_input

Monta uma URL assim:

pagina?idchannel=VALOR&r=VALOR

Usa:

$("#up").load(link);

👉 Isso é jQuery AJAX — carrega o conteúdo da página dentro da div #up sem recarregar o site inteiro.

🔄 5) Função carregar2(pagina, event)
O que faz:

Carrega uma página na #up e controla o campo de busca.

🛑 Impede comportamento padrão
if (event) event.preventDefault();

Evita que links recarreguem a página inteira.

🔍 Limpa a busca ao navegar

Se a página não for uma busca (busca=), ele:

Limpa o campo #cqb-search-input

Esconde o botão de limpar busca

🔄 Depois carrega a página
$("#up").load(pagina);
📦 6) Função carregar3(pagina)
function carregar3(pagina) {
    $("#atual").load(pagina);
}
O que faz:

Carrega o conteúdo da página dentro da div #atual.

👉 É igual ao carregar2, mas usa outro container.

📲 7) Detecção de dispositivo mobile
const isMobile = { ... }

Objeto que detecta tipo de celular pelo userAgent.

Métodos:

Android()

BlackBerry()

iOS()

Opera()

Windows()

Cada um verifica se o navegador corresponde a aquele sistema.

📌 Método principal
any()

Retorna true se for qualquer dispositivo mobile.

Exemplo de uso:

if (isMobile.any()) {
   // código para celular
}
🎥 8) Script do Rumble

Esse trecho:

!function (r, u, m, b, l, e) { ... }

É um script oficial do player da plataforma Rumble.

O que ele faz:

Cria a função global Rumble

Carrega dinamicamente o script:

https://rumble.com/embedJS/u13bnay

Permite incorporar vídeos da plataforma na página

Ele carrega o player automaticamente quando você chama algo como:

Rumble('play', { video: 'ID_DO_VIDEO' });



<script>
    // Suprimir logs do console em produção
    console.log = function() {};
    console.info = function() {};
    console.warn = function() {};
    console.debug = function() {};
    console.error = function() {};
    console.trace = function() {};
    console.table = function() {};
    // Scroll to Top
    const scrollBtn = document.querySelector('.scroll-to-top');
    if (scrollBtn) {
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    scrollBtn.classList.toggle('show', window.pageYOffset > 300);
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        scrollBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Toggle Sidebar (mobile)
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('accordionSidebar');
        const toggleBtn = e.target.closest('[data-toggle="sidebar"]');
        
        if (toggleBtn) {
            if (sidebar) sidebar.classList.toggle('active');
        } else if (sidebar && sidebar.classList.contains('active')) {
            // Se o clique for fora do sidebar
            if (!sidebar.contains(e.target)) {
                sidebar.classList.remove('active');
            } 
            // Se o clique for em um link de navegação REAL (que não abre submenu)
            else if (e.target.closest('.cqb-submenu-link, .cqb-nav-link')) {
                const navLink = e.target.closest('.cqb-nav-link');
                const hasSub = navLink && navLink.parentElement.classList.contains('has-submenu');
                
                // Só fecha se NÃO for um disparador de submenu
                if (!hasSub || e.target.closest('.cqb-submenu-link')) {
                    sidebar.classList.remove('active');
                }
            }
        }
    });

    // Functions
    function conectar(pagina) {
        const idchannel = (document.getElementById("idchannel")?.value || '').trim();
        const r = (document.getElementById("referencia_input")?.value || '').trim();
        const link = `${pagina}?idchannel=${encodeURIComponent(idchannel)}${r ? `&r=${encodeURIComponent(r)}` : ''}`;
        $("#up").load(link);
    }

    function carregar2(pagina, event) {
        if (event) event.preventDefault();
        
        // Limpar busca ao navegar (exceto se a navegação for a própria busca)
        const isSearch = pagina.includes('busca=');
        const searchInput = document.getElementById('cqb-search-input');
        
        if (searchInput && !isSearch) {
            searchInput.value = '';
            const clearBtn = document.getElementById('cqb-search-clear');
            if (clearBtn) clearBtn.style.display = 'none';
        }
        
        $("#up").load(pagina);
    }

    function carregar3(pagina) {
        $("#atual").load(pagina);
    }

    // Mobile Detection
    const isMobile = {
        Android: () => navigator.userAgent.match(/Android/i),
        BlackBerry: () => navigator.userAgent.match(/BlackBerry/i),
        iOS: () => navigator.userAgent.match(/iPhone|iPad|iPod/i),
        Opera: () => navigator.userAgent.match(/Opera Mini/i),
        Windows: () => navigator.userAgent.match(/IEMobile|WPDesktop/i),
        any: function () {
            return this.Android() || this.BlackBerry() || this.iOS() ||
                this.Opera() || this.Windows();
        }
    };

</script>

<script>
    !function (r, u, m, b, l, e) { r._Rumble = b, r[b] || (r[b] = function () { (r[b]._ = r[b]._ || []).push(arguments); if (r[b]._.length == 1) { l = u.createElement(m), e = u.getElementsByTagName(m)[0], l.async = 1, l.src = "https://rumble.com/embedJS/u13bnay" + (arguments[1].video ? '.' + arguments[1].video : '') + "/?url=" + encodeURIComponent(location.href) + "&args=" + encodeURIComponent(JSON.stringify([].slice.apply(arguments))), e.parentNode.insertBefore(l, e) } }) }(window, document, "script", "Rumble");
</script>	