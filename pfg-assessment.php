<?php
/**
 * Plugin Name: PFG Predictive Index Assessment
 * Description: GLO PFG Predictive Index - Secure manager assessment tool with 10 CSF scoring.
 * Version:     1.0.0
 * Author:      PFG
 * Text Domain: pfg-assessment
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'PFG_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'PFG_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

// ─── ACTIVATION ───────────────────────────────────────────────────────────
register_activation_hook( __FILE__, 'pfg_activate' );
function pfg_activate() {
    global $wpdb;
    $table   = $wpdb->prefix . 'pfg_assessments';
    $charset = $wpdb->get_charset_collate();
    $sql = "CREATE TABLE IF NOT EXISTS {$table} (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        user_name varchar(100) NOT NULL,
        company varchar(100) NOT NULL,
        department varchar(100) NOT NULL,
        email varchar(100) NOT NULL,
        score_communication tinyint(2) NOT NULL,
        score_knowledge tinyint(2) NOT NULL,
        score_leadership tinyint(2) NOT NULL,
        score_measurement tinyint(2) NOT NULL,
        score_morale tinyint(2) NOT NULL,
        score_process tinyint(2) NOT NULL,
        score_recognition tinyint(2) NOT NULL,
        score_resource_qty tinyint(2) NOT NULL,
        score_resource_qual tinyint(2) NOT NULL,
        score_standards tinyint(2) NOT NULL,
        total_score tinyint(3) NOT NULL,
        submitted_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) {$charset};";
    $sql2 = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}pfg_companies (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        name varchar(100) NOT NULL,
        slug varchar(100) NOT NULL,
        logo_url varchar(500) NOT NULL DEFAULT '',
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY slug (slug)
    ) {$charset};";
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql );
    dbDelta( $sql2 );
    update_option( 'pfg_db_version', '1.1.0' );
}

// ─── DB VERSION CHECK ─────────────────────────────────────────────────────
add_action( 'admin_init', 'pfg_check_db_update' );
function pfg_check_db_update() {
    if ( get_option( 'pfg_db_version' ) !== '1.1.0' ) {
        pfg_activate();
    }
}

// ─── CLIENT LOGIN HANDLER ─────────────────────────────────────────────────
add_action( 'template_redirect', 'pfg_handle_client_login' );
function pfg_handle_client_login() {
    if ( 'POST' !== $_SERVER['REQUEST_METHOD'] || ! isset( $_POST['pfg_login_slug'] ) ) return;
    $slug = sanitize_text_field( wp_unslash( $_POST['pfg_login_slug'] ) );
    if ( ! $slug ) return;
    if ( ! isset( $_POST['pfg_login_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['pfg_login_nonce'] ) ), 'pfg_client_login_' . $slug ) ) return;
    $password   = isset( $_POST['pfg_login_password'] ) ? wp_unslash( $_POST['pfg_login_password'] ) : '';
    $admin_page = get_page_by_path( $slug . '-admin' );
    if ( ! $admin_page ) return;
    $stored = get_post_meta( $admin_page->ID, '_pfg_dashboard_password', true );
    if ( $password === $stored ) {
        setcookie( 'pfg_auth_' . $slug, '1', time() + 8 * HOUR_IN_SECONDS, COOKIEPATH, COOKIE_DOMAIN );
        wp_safe_redirect( home_url( '/' . $slug . '-admin' ) );
        exit;
    }
    wp_safe_redirect( add_query_arg( 'pfg_err', '1', home_url( '/' . $slug . '-admin' ) ) );
    exit;
}

// ─── CLIENT LOGIN SHORTCODE ───────────────────────────────────────────────
add_shortcode( 'pfg_client_login', 'pfg_render_client_login' );
function pfg_render_client_login( $atts = [] ) {
    $atts  = shortcode_atts( [ 'company_slug' => '' ], $atts );
    $slug  = $atts['company_slug'];

    if ( $slug && ! empty( $_COOKIE[ 'pfg_auth_' . $slug ] ) ) {
        return pfg_render_admin_dashboard( [ 'company_slug' => $slug ] );
    }

    $logo_url       = PFG_PLUGIN_URL . 'assets/images/logo.png';
    $co_name_login  = '';
    $has_logo_login = false;
    if ( $slug ) {
        global $wpdb;
        $co_table = $wpdb->prefix . 'pfg_companies';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $co_row = $wpdb->get_row( $wpdb->prepare( "SELECT name, logo_url FROM {$co_table} WHERE slug = %s", $slug ) );
        if ( $co_row ) {
            $co_name_login = $co_row->name;
            if ( $co_row->logo_url ) { $logo_url = $co_row->logo_url; $has_logo_login = true; }
        }
    }
    ob_start();
    ?>
    <div id="pfg-wrap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:2rem 1rem;">
        <div style="width:100%;max-width:380px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:2rem;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
            <div style="text-align:center;margin-bottom:1.5rem;">
                <?php if ( $slug && ! $has_logo_login && $co_name_login ) : ?>
                    <span class="pfg-company-name-title" style="display:block;margin-bottom:1rem;"><?php echo esc_html( $co_name_login ); ?></span>
                <?php elseif ( $has_logo_login || ! $slug ) : ?>
                    <img src="<?php echo esc_url( $logo_url ); ?>" alt="Logo" style="max-height:60px;max-width:180px;object-fit:contain;margin-bottom:1rem;display:block;margin-left:auto;margin-right:auto;">
                <?php endif; ?>
                <h2 style="font-size:1.25rem;font-weight:700;color:#1e293b;margin:0 0 0.25rem;">Dashboard Access</h2>
                <p style="font-size:0.85rem;color:#64748b;margin:0;">Enter your password to continue.</p>
            </div>
            <form method="post">
                <?php wp_nonce_field( 'pfg_client_login_' . $slug, 'pfg_login_nonce' ); ?>
                <input type="hidden" name="pfg_login_slug" value="<?php echo esc_attr( $slug ); ?>">
                <div style="margin-bottom:1.25rem;">
                    <label style="display:block;font-size:0.8rem;font-weight:600;color:#475569;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.04em;">Password</label>
                    <input type="password" name="pfg_login_password" style="width:100%;padding:0.65rem 0.75rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.95rem;box-sizing:border-box;outline:none;" autofocus required>
                </div>
                <button type="submit" style="width:100%;padding:0.7rem;background:#22C55E;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.95rem;cursor:pointer;letter-spacing:0.01em;">Enter Dashboard</button>
                <?php if ( isset( $_GET['pfg_err'] ) ) : ?>
                    <p class="pfg-login-error" style="color:#ef4444;margin-top:0.75rem;font-size:0.875rem;text-align:center;margin-bottom:0;">Incorrect password. Please try again.</p>
                <?php endif; ?>
            </form>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

// ─── BLANK TEMPLATE ───────────────────────────────────────────────────────
add_filter( 'template_include', 'pfg_blank_template' );
function pfg_blank_template( $template ) {
    if ( is_page() && '1' === get_post_meta( get_the_ID(), '_pfg_generated_page', true ) ) {
        return PFG_PLUGIN_DIR . 'templates/blank-template.php';
    }
    return $template;
}

// ─── ENQUEUE ASSETS ───────────────────────────────────────────────────────
add_action( 'wp_enqueue_scripts', 'pfg_enqueue_assets' );
function pfg_enqueue_assets() {
    wp_enqueue_style(
        'pfg-google-fonts',
        'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
        [], null
    );
    wp_enqueue_style( 'pfg-style', PFG_PLUGIN_URL . 'assets/css/style.css', [], time() );
    wp_enqueue_script(
        'chart-js',
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
        [], '4.4.0', true
    );
    wp_enqueue_script(
        'jspdf',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        [], '2.5.1', true
    );
    wp_enqueue_script( 'pfg-engine', PFG_PLUGIN_URL . 'assets/js/engine.js', [ 'chart-js', 'jspdf' ], time(), true );
    wp_localize_script( 'pfg-engine', 'pfgData', [
        'ajaxUrl'   => admin_url( 'admin-ajax.php' ),
        'nonce'     => wp_create_nonce( 'pfg_submit_nonce' ),
        'pluginUrl' => PFG_PLUGIN_URL,
    ] );
}

// ─── SHORTCODE ────────────────────────────────────────────────────────────
add_shortcode( 'pfg_assessment', 'pfg_render_assessment' );
function pfg_render_assessment( $atts = [] ) {
    $atts            = shortcode_atts( [ 'company_slug' => '' ], $atts );
    $logo_url        = PFG_PLUGIN_URL . 'assets/images/logo.png';
    $co_name         = '';
    $has_custom_logo = false;
    if ( $atts['company_slug'] ) {
        global $wpdb;
        $co_table = $wpdb->prefix . 'pfg_companies';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $co_row = $wpdb->get_row( $wpdb->prepare( "SELECT name, logo_url FROM {$co_table} WHERE slug = %s", $atts['company_slug'] ) );
        if ( $co_row ) {
            $co_name = $co_row->name;
            if ( $co_row->logo_url ) { $logo_url = $co_row->logo_url; $has_custom_logo = true; }
        }
    }
    wp_add_inline_script( 'pfg-engine', 'if(window.pfgData){pfgData.logoUrl=' . wp_json_encode( $has_custom_logo ? $logo_url : '' ) . ';}', 'after' );
    $csfs = [
        'communication' => [
            'label' => 'Communication',
            'tip'   => "There's an atmosphere of open communication.\nMy people are informed.\nThere's a two way dialogue between me and team.\nMy department meet on consistent and regular basis.\nMy team members communicate with each other effectively.\nInformation is quickly and clearly dispersed to team.\nInformation is delivered in an effective way.\nInformation is fully understood by team.",
        ],
        'knowledge'     => [
            'label' => 'Knowledge & Skills',
            'tip'   => 'Team have capacity to do job function and responsibility.',
        ],
        'leadership'    => [
            'label' => 'Leadership',
            'tip'   => 'How well is the team inspired by you to do "Great" things?',
        ],
        'measurement'   => [
            'label' => 'Measurement',
            'tip'   => "Tools are in place to quantify the efficiency and effectiveness of department's performance.\nTied to \"Standards\".",
        ],
        'morale'        => [
            'label' => 'Morale',
            'tip'   => 'The state of mind or spirit de corps of the group as exhibited by confidence, cheerfulness, discipline, belief and willingness to follow superior and goals of the organization; work well with members of the group as well as perform the assigned tasks.',
        ],
        'process'       => [
            'label' => 'Process & Procedure',
            'tip'   => 'The P&P of the department are in place and clear.',
        ],
        'recognition'   => [
            'label' => 'Recognition',
            'tip'   => 'How well achievements and contributions are acknowledged and rewarded.',
        ],
        'resource_qty'  => [
            'label' => 'Resource (Quantity)',
            'tip'   => 'Department is appropriately staffed.',
        ],
        'resource_qual' => [
            'label' => 'Resource (Quality)',
            'tip'   => 'The team has the mental capacity, attitude and aptitude to learn and perform job functions.',
        ],
        'standards'     => [
            'label' => 'Standards',
            'tip'   => "Clear written and communicated criterias, requirements and benchmarks to be appraised at a particular level of performance.\n\nStandards include:\n\u{2022} Quality \u{2013} how well the work is performed; accuracy, appearance, usefulness.\n\u{2022} Quantity \u{2013} how much work is produced or a general result to be achieved.\n\u{2022} Timeliness \u{2013} how quickly or by what date the work is produced.\n\u{2022} Cost-Effectiveness \u{2013} dollar savings; working within a budget; reducing unit costs.",
        ],
    ];

    ob_start();
    ?>
    <div id="pfg-wrap">

        <!-- ASSESSMENT FORM -->
        <div id="pfg-form-section">
            <div class="pfg-header">
                <div class="pfg-logo-mark">
                    <?php if ( $atts['company_slug'] && ! $has_custom_logo && $co_name ) : ?>
                        <span class="pfg-company-name-title"><?php echo esc_html( $co_name ); ?></span>
                    <?php else : ?>
                        <img src="<?php echo esc_url( $logo_url ); ?>" class="pfg-logo-img" alt="Logo">
                    <?php endif; ?>
                </div>
                <h1 class="pfg-title">PFG Predictive Index</h1>
                <p class="pfg-subtitle">Team Performance Diagnostic</p>
            </div>

            <form id="pfg-form" novalidate>
                <?php wp_nonce_field( 'pfg_submit_nonce', 'pfg_nonce_field' ); ?>

                <section class="pfg-section pfg-capture">
                    <h2 class="pfg-section-title">Your Information</h2>
                    <div class="pfg-grid-2">
                        <div class="pfg-field">
                            <label for="pfg-name">Full Name <span class="req">*</span></label>
                            <input type="text" id="pfg-name" name="user_name" placeholder="e.g. Jane Smith" required>
                        </div>
                        <div class="pfg-field">
                            <label for="pfg-email">Email <span class="pfg-optional">(optional)</span></label>
                            <input type="email" id="pfg-email" name="email" placeholder="jane@company.com">
                        </div>
                        <?php if ( $atts['company_slug'] ) : ?>
                        <input type="hidden" name="company" value="<?php echo esc_attr( $atts['company_slug'] ); ?>">
                        <?php else : ?>
                        <div class="pfg-field">
                            <label for="pfg-company">Company <span class="req">*</span></label>
                            <input type="text" id="pfg-company" name="company" placeholder="Company name" required>
                        </div>
                        <?php endif; ?>
                        <div class="pfg-field">
                            <label for="pfg-dept">Department / Unit <span class="req">*</span></label>
                            <input type="text" id="pfg-dept" name="department" placeholder="e.g. Operations" required>
                        </div>
                    </div>
                </section>

                <section class="pfg-section pfg-assessment">
                    <h2 class="pfg-section-title">Critical Success Factors (CSF) <span class="pfg-tooltip-icon pfg-csf-def-icon" data-tip="Critical Success Factors (CSFs) are the key organizational capabilities that must be consistently strong for a team to execute effectively and achieve sustained performance. This tool measures how well these factors are functioning today, helping managers identify strengths to leverage and gaps that present opportunities for improvement.">?</span></h2>
                    <p class="pfg-section-desc">Rate each factor from <strong>1</strong> (Critically Low) to <strong>10</strong> (Excellent). All 10 must be completed.</p>
                    <div class="pfg-csf-list">
                    <?php $i = 1; foreach ( $csfs as $key => $csf ) : ?>
                        <div class="pfg-csf-row">
                            <div class="pfg-csf-label-wrap">
                                <span class="pfg-csf-num"><?php echo esc_html( sprintf( '%02d', $i++ ) ); ?></span>
                                <span class="pfg-csf-name"><?php echo esc_html( $csf['label'] ); ?></span>
                                <span class="pfg-tooltip-icon" data-tip="<?php echo esc_attr( $csf['tip'] ); ?>">?</span>
                            </div>
                            <div class="pfg-csf-input-wrap">
                                <input type="range" class="pfg-slider"
                                    id="csf-<?php echo esc_attr( $key ); ?>"
                                    name="score_<?php echo esc_attr( $key ); ?>"
                                    min="1" max="10" value="5" data-unset="true">
                                <span class="pfg-slider-val" id="val-<?php echo esc_attr( $key ); ?>">&#8211;</span>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    </div>
                    <div class="pfg-live-score-wrap">
                        <span class="pfg-live-label">Live Total Score:</span>
                        <span id="pfg-live-total" class="pfg-live-total">&#8211;</span>
                        <span class="pfg-live-max">/ 100</span>
                    </div>
                </section>

                <div id="pfg-error-msg" class="pfg-error" style="display:none;"></div>

                <button type="submit" id="pfg-submit-btn" class="pfg-btn-primary">
                    <span class="btn-text">Submit Assessment</span>
                    <span class="btn-loading" style="display:none;">Submitting&#8230;</span>
                </button>
            </form>
            <div id="pfg-mobile-tooltip"></div>
        </div>

        <!-- RESULTS SECTION -->
        <div id="pfg-results" style="display:none;">
            <div class="pfg-header">
                <div class="pfg-logo-mark">
                    <?php if ( $atts['company_slug'] && ! $has_custom_logo && $co_name ) : ?>
                        <span class="pfg-company-name-title"><?php echo esc_html( $co_name ); ?></span>
                    <?php else : ?>
                        <img src="<?php echo esc_url( $logo_url ); ?>" class="pfg-logo-img" alt="Logo">
                    <?php endif; ?>
                </div>
                <h1 class="pfg-title">Assessment Results</h1>
            </div>
            <div class="pfg-results-body">
                <div class="pfg-score-card">
                    <p class="pfg-score-label">Total Score</p>
                    <div class="pfg-score-circle">
                        <span id="res-total">&#8211;</span>
                        <small>/ 100</small>
                    </div>
                    <div id="res-tier" class="pfg-tier-badge">&#8211;</div>
                    <p id="res-interpretation" class="pfg-interpretation-text"></p>
                </div>
                <div class="pfg-chart-wrap">
                    <canvas id="pfg-chart"></canvas>
                </div>
            </div>
            <div class="pfg-results-actions">
                <button id="pfg-pdf-btn" class="pfg-btn-primary" style="width:auto;padding:0.75rem 2rem;">&#8595; Download PDF Report</button>
                <button id="pfg-retake-btn" class="pfg-btn-secondary">Take Assessment Again</button>
            </div>
        </div>

    </div>
    <?php
    return ob_get_clean();
}

// ─── AJAX HANDLER ─────────────────────────────────────────────────────────
add_action( 'wp_ajax_pfg_submit',        'pfg_handle_submit' );
add_action( 'wp_ajax_nopriv_pfg_submit', 'pfg_handle_submit' );
function pfg_handle_submit() {
    check_ajax_referer( 'pfg_submit_nonce', 'nonce' );

    $csf_keys = [
        'communication', 'knowledge', 'leadership', 'measurement', 'morale',
        'process', 'recognition', 'resource_qty', 'resource_qual', 'standards',
    ];

    $scores = [];
    foreach ( $csf_keys as $key ) {
        $val = isset( $_POST[ 'score_' . $key ] ) ? intval( $_POST[ 'score_' . $key ] ) : 0;
        if ( $val < 1 || $val > 10 ) {
            wp_send_json_error( [ 'message' => 'All 10 CSF scores must be between 1 and 10.' ] );
        }
        $scores[ $key ] = $val;
    }

    $total = array_sum( $scores );

    global $wpdb;
    $table       = $wpdb->prefix . 'pfg_assessments';
    $company_raw = sanitize_text_field( wp_unslash( $_POST['company'] ?? '' ) );
    $co_tbl      = $wpdb->prefix . 'pfg_companies';
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    $resolved    = $wpdb->get_var( $wpdb->prepare( "SELECT name FROM {$co_tbl} WHERE slug = %s", $company_raw ) );
    $company     = $resolved ? $resolved : $company_raw;
    $result = $wpdb->insert( $table, [
        'user_name'           => sanitize_text_field( wp_unslash( $_POST['user_name'] ?? '' ) ),
        'company'             => $company,
        'department'          => sanitize_text_field( wp_unslash( $_POST['department'] ?? '' ) ),
        'email'               => sanitize_email( wp_unslash( $_POST['email'] ?? '' ) ),
        'score_communication' => $scores['communication'],
        'score_knowledge'     => $scores['knowledge'],
        'score_leadership'    => $scores['leadership'],
        'score_measurement'   => $scores['measurement'],
        'score_morale'        => $scores['morale'],
        'score_process'       => $scores['process'],
        'score_recognition'   => $scores['recognition'],
        'score_resource_qty'  => $scores['resource_qty'],
        'score_resource_qual' => $scores['resource_qual'],
        'score_standards'     => $scores['standards'],
        'total_score'         => $total,
    ] );

    if ( false === $result ) {
        wp_send_json_error( [ 'message' => 'Database error. Please try again.' ] );
    }

    wp_send_json_success( [
        'total'          => $total,
        'scores'         => array_values( $scores ),
        'tier'           => pfg_get_tier( $total ),
        'interpretation' => pfg_get_interpretation( $total ),
    ] );
}

function pfg_get_interpretation( int $score ): string {
    if ( $score >= 90 ) return 'The team is highly aligned and consistently executing at a high level. Systems, leadership, and behaviors are working well together. Focus on sustaining performance and driving continuous improvement.';
    if ( $score >= 80 ) return 'The team is performing well with some minor gaps. There is a solid foundation in place, with opportunities to refine and optimize specific areas.';
    if ( $score >= 70 ) return 'The team is generally functioning, but inconsistencies exist. Certain areas may be limiting overall performance and should be addressed to unlock greater effectiveness.';
    if ( $score >= 60 ) return 'There are clear gaps in how the team operates. Performance is likely inconsistent, and targeted improvements are needed to strengthen execution and alignment.';
    return 'Core drivers of performance are not functioning effectively. Immediate focus is required to address foundational issues and stabilize team performance.';
}

function pfg_get_tier( int $score ): string {
    if ( $score >= 90 ) return 'High Performing';
    if ( $score >= 80 ) return 'Strong';
    if ( $score >= 70 ) return 'Stable';
    if ( $score >= 60 ) return 'Developing';
    return 'At Risk';
}

// ─── ADMIN PAGE ───────────────────────────────────────────────────────────
add_action( 'admin_menu', 'pfg_admin_menu' );
function pfg_admin_menu() {
    add_menu_page(
        'PFG Assessments', 'PFG Assessments',
        'manage_options', 'pfg-assessments',
        'pfg_render_admin_page',
        'dashicons-chart-bar', 30
    );
}

function pfg_render_admin_page() {
    global $wpdb;
    $table = $wpdb->prefix . 'pfg_assessments';

    $csf_cols = [
        'score_communication' => 'Comm.',
        'score_knowledge'     => 'Know.',
        'score_leadership'    => 'Lead.',
        'score_measurement'   => 'Meas.',
        'score_morale'        => 'Morale',
        'score_process'       => 'Proc.',
        'score_recognition'   => 'Recog.',
        'score_resource_qty'  => 'Res.Qty',
        'score_resource_qual' => 'Res.Qual',
        'score_standards'     => 'Std.',
    ];

    // Filters
    $filter_company = isset( $_GET['pfg_company'] ) ? sanitize_text_field( wp_unslash( $_GET['pfg_company'] ) ) : '';
    $filter_dept    = isset( $_GET['pfg_dept'] )    ? sanitize_text_field( wp_unslash( $_GET['pfg_dept'] ) )    : '';

    $where  = 'WHERE 1=1';
    $params = [];
    if ( $filter_company ) { $where .= ' AND company = %s';    $params[] = $filter_company; }
    if ( $filter_dept )    { $where .= ' AND department = %s'; $params[] = $filter_dept; }

    // phpcs:disable WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.NotPrepared
    if ( $params ) {
        // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
        $rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} {$where} ORDER BY submitted_at DESC", ...$params ) );
    } else {
        $rows = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY submitted_at DESC" );
    }

    // Aggregate averages (unfiltered)
    $avg_total = $wpdb->get_var( "SELECT AVG(total_score) FROM {$table}" );
    $csf_avgs  = [];
    foreach ( array_keys( $csf_cols ) as $col ) {
        $csf_avgs[ $col ] = $wpdb->get_var( "SELECT AVG({$col}) FROM {$table}" );
    }

    // Filter option lists
    $companies   = $wpdb->get_col( "SELECT DISTINCT company FROM {$table} ORDER BY company" );
    $departments = $wpdb->get_col( "SELECT DISTINCT department FROM {$table} ORDER BY department" );
    // phpcs:enable

    $page_url = admin_url( 'admin.php?page=pfg-assessments' );
    ?>
    <div class="wrap">
        <h1 style="display:flex;align-items:center;gap:12px;">
            PFG Predictive Index &#8212; Submissions
            <a href="<?php echo esc_url( admin_url( 'admin-post.php?action=pfg_export_csv' ) ); ?>"
               class="button button-secondary">&#8595; Export CSV</a>
        </h1>

        <!-- Aggregate Averages -->
        <?php if ( $avg_total ) : ?>
        <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px 20px;margin:16px 0;">
            <strong>Aggregate Averages</strong>
            <table style="margin-top:10px;border-collapse:collapse;width:100%;">
                <tr>
                    <th style="text-align:left;padding:4px 10px 4px 0;white-space:nowrap;">Total Score Avg</th>
                    <td style="padding:4px 0;"><strong><?php echo esc_html( number_format( (float) $avg_total, 1 ) ); ?> / 100</strong></td>
                </tr>
                <?php foreach ( $csf_cols as $col => $label ) : ?>
                <tr>
                    <th style="text-align:left;padding:4px 10px 4px 0;white-space:nowrap;font-weight:normal;"><?php echo esc_html( $label ); ?></th>
                    <td style="padding:4px 0;"><?php echo esc_html( number_format( (float) $csf_avgs[ $col ], 1 ) ); ?> / 10</td>
                </tr>
                <?php endforeach; ?>
            </table>
        </div>
        <?php endif; ?>

        <!-- Filters -->
        <form method="get" action="<?php echo esc_url( $page_url ); ?>" style="margin-bottom:16px;">
            <input type="hidden" name="page" value="pfg-assessments">
            <select name="pfg_company" style="margin-right:8px;">
                <option value="">All Companies</option>
                <?php foreach ( $companies as $c ) : ?>
                    <option value="<?php echo esc_attr( $c ); ?>" <?php selected( $filter_company, $c ); ?>><?php echo esc_html( $c ); ?></option>
                <?php endforeach; ?>
            </select>
            <select name="pfg_dept" style="margin-right:8px;">
                <option value="">All Departments</option>
                <?php foreach ( $departments as $d ) : ?>
                    <option value="<?php echo esc_attr( $d ); ?>" <?php selected( $filter_dept, $d ); ?>><?php echo esc_html( $d ); ?></option>
                <?php endforeach; ?>
            </select>
            <button type="submit" class="button">Filter</button>
            <?php if ( $filter_company || $filter_dept ) : ?>
                <a href="<?php echo esc_url( $page_url ); ?>" class="button" style="margin-left:6px;">Clear</a>
            <?php endif; ?>
        </form>

        <!-- Submissions Table -->
        <div style="overflow-x:auto;">
        <table class="wp-list-table widefat fixed striped" style="min-width:1100px;">
            <thead>
                <tr>
                    <th style="width:32px">#</th>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Dept</th>
                    <th>Email</th>
                    <?php foreach ( $csf_cols as $col => $label ) : ?>
                        <th style="width:56px;text-align:center;" title="<?php echo esc_attr( $col ); ?>"><?php echo esc_html( $label ); ?></th>
                    <?php endforeach; ?>
                    <th style="width:56px;text-align:center;">Total</th>
                    <th style="width:90px;">Tier</th>
                    <th style="width:130px;">Date</th>
                </tr>
            </thead>
            <tbody>
            <?php if ( empty( $rows ) ) : ?>
                <tr><td colspan="<?php echo 8 + count( $csf_cols ); ?>">No submissions found.</td></tr>
            <?php else : foreach ( $rows as $row ) : ?>
                <tr>
                    <td><?php echo esc_html( $row->id ); ?></td>
                    <td><?php echo esc_html( $row->user_name ); ?></td>
                    <td><?php echo esc_html( $row->company ); ?></td>
                    <td><?php echo esc_html( $row->department ); ?></td>
                    <td><?php echo esc_html( $row->email ); ?></td>
                    <?php foreach ( array_keys( $csf_cols ) as $col ) : ?>
                        <td style="text-align:center;"><?php echo esc_html( $row->$col ); ?></td>
                    <?php endforeach; ?>
                    <td style="text-align:center;"><strong><?php echo esc_html( $row->total_score ); ?></strong></td>
                    <td><?php echo esc_html( pfg_get_tier( (int) $row->total_score ) ); ?></td>
                    <td><?php echo esc_html( $row->submitted_at ); ?></td>
                </tr>
            <?php endforeach; endif; ?>
            </tbody>
        </table>
        </div>
    </div>
    <?php
}

// ─── FRONTEND ADMIN DASHBOARD ─────────────────────────────────────────────
add_shortcode( 'pfg_admin_dashboard', 'pfg_render_admin_dashboard' );
function pfg_render_admin_dashboard( $atts = [] ) {
    $atts            = shortcode_atts( [ 'company_slug' => '' ], $atts );
    $logo_url        = PFG_PLUGIN_URL . 'assets/images/logo.png';
    $co_name_dash    = '';
    $has_custom_logo_dash = false;
    if ( $atts['company_slug'] ) {
        global $wpdb;
        $co_table = $wpdb->prefix . 'pfg_companies';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $co_row = $wpdb->get_row( $wpdb->prepare( "SELECT name, logo_url FROM {$co_table} WHERE slug = %s", $atts['company_slug'] ) );
        if ( $co_row ) {
            $co_name_dash = $co_row->name;
            if ( $co_row->logo_url ) { $logo_url = $co_row->logo_url; $has_custom_logo_dash = true; }
        }
    }
    $trend_depts = [];
    if ( $atts['company_slug'] && $co_name_dash ) {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $trend_depts = $wpdb->get_col( $wpdb->prepare( "SELECT DISTINCT department FROM {$wpdb->prefix}pfg_assessments WHERE company = %s ORDER BY department", $co_name_dash ) );
    }
    wp_enqueue_media();
    wp_enqueue_script( 'pfg-dashboard', PFG_PLUGIN_URL . 'assets/js/dashboard.js', [ 'chart-js', 'jspdf' ], time(), true );
    wp_localize_script( 'pfg-dashboard', 'pfgDashData', [
        'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
        'nonce'       => wp_create_nonce( 'pfg_dashboard_nonce' ),
        'pluginUrl'   => PFG_PLUGIN_URL,
        'logoUrl'     => $logo_url,
        'companySlug' => $atts['company_slug'],
        'trendDepts'  => $trend_depts,
    ] );
    ob_start();
    ?>
    <div id="pfg-dashboard" class="pfg-dash-wrap">

        <div class="pfg-header">
            <div class="pfg-logo-mark">
                <?php if ( $atts['company_slug'] && ! $has_custom_logo_dash && $co_name_dash ) : ?>
                    <span class="pfg-company-name-title"><?php echo esc_html( $co_name_dash ); ?></span>
                <?php else : ?>
                    <img src="<?php echo esc_url( $logo_url ); ?>" class="pfg-logo-img" alt="Logo">
                <?php endif; ?>
            </div>
            <h1 class="pfg-title">Admin Dashboard</h1>
            <p class="pfg-subtitle">PFG Predictive Index &#8212; Aggregate Results</p>
        </div>

        <!-- Aggregate Averages -->
        <div class="pfg-section">
            <h2 class="pfg-section-title">Aggregate Averages</h2>
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-bottom:1rem;">
                <select id="pfg-dash-timeframe" class="pfg-dash-select" style="min-width:160px;">
                    <option value="all" selected>All Time</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="quarter">Last Quarter</option>
                    <option value="12m">Last 12 Months</option>
                    <option value="custom">Custom Date Range</option>
                </select>
                <input type="date" id="pfg-dash-date-from" class="pfg-dash-select" title="From" style="width:140px;flex-shrink:0;">
                <input type="date" id="pfg-dash-date-to" class="pfg-dash-select" title="To" style="width:140px;flex-shrink:0;">
                <button id="pfg-dash-filter-btn" class="pfg-btn-primary" style="width:auto;padding:0.55rem 1.25rem;font-size:0.875rem;flex-shrink:0;">Filter</button>
            </div>
            <div id="pfg-dash-avg-content">
                <p class="pfg-dash-loading">Loading&#8230;</p>
            </div>
        </div>

        <!-- Benchmarking -->
        <div class="pfg-section">
            <h2 class="pfg-section-title">Benchmarking</h2>
            <p class="pfg-section-desc">Compare a company&#8217;s CSF averages against the global average.</p>
            <div class="pfg-dash-bench-controls" id="pfg-bench-co-controls">
                <p style="font-size:0.8rem;color:#64748b;margin-bottom:0.5rem;">Select one or more companies to compare:</p>
                <div id="pfg-bench-co-checkboxes" style="display:flex;flex-wrap:wrap;gap:0.5rem 1.25rem;max-height:120px;overflow-y:auto;padding:4px 0;">
                    <span style="color:#94a3b8;font-size:0.8rem;">Loading&#8230;</span>
                </div>
            </div>
            <div id="pfg-bench-chart-wrap" style="position:relative;height:320px;margin-top:1.25rem;">
                <canvas id="pfg-bench-chart"></canvas>
            </div>
            <p id="pfg-bench-placeholder" style="color:#94a3b8;font-size:0.875rem;text-align:center;margin-top:2rem;">Select a company above to view its comparison chart.</p>
        </div>

        <!-- Trend Chart (client view only) -->
        <?php if ( $atts['company_slug'] ) : ?>
        <div class="pfg-section" id="pfg-trend-section">
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-bottom:1rem;">
                <h2 class="pfg-section-title" style="margin-bottom:0;border-bottom:none;padding-bottom:0;flex:1;">Performance Trend</h2>
                <select id="pfg-trend-dept" class="pfg-dash-select" style="min-width:140px;">
                    <option value="">All Departments</option>
                </select>
                <select id="pfg-trend-granularity" class="pfg-dash-select" style="min-width:110px;">
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month" selected>Month</option>
                    <option value="year">Year</option>
                </select>
            </div>
            <p class="pfg-section-desc" style="margin-top:0;">Average total score over time.</p>
            <div style="position:relative;height:240px;">
                <canvas id="pfg-trend-chart"></canvas>
            </div>
        </div>
        <?php endif; ?>

        <!-- Submissions -->
        <div class="pfg-section">
            <h2 class="pfg-section-title">Submissions</h2>
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-bottom:1.5rem;">
                <select id="pfg-dash-company" class="pfg-dash-select" style="min-width:160px;">
                    <option value="">All Companies</option>
                </select>
                <select id="pfg-dash-dept" class="pfg-dash-select" style="min-width:160px;">
                    <option value="">All Departments</option>
                </select>
                <input type="date" id="pfg-sub-date-from" class="pfg-dash-select" title="From" style="width:140px;flex-shrink:0;">
                <input type="date" id="pfg-sub-date-to" class="pfg-dash-select" title="To" style="width:140px;flex-shrink:0;">
                <button id="pfg-sub-filter-btn" class="pfg-btn-primary" style="width:auto;padding:0.55rem 1.25rem;font-size:0.875rem;flex-shrink:0;">Filter</button>
                <button id="pfg-dash-export-btn" class="pfg-btn-secondary" style="padding:0.55rem 1.25rem;font-size:0.875rem;flex-shrink:0;margin-left:auto;">&#8595; Export CSV</button>
            </div>
            <div id="pfg-dash-table-wrap"></div>
        </div>

        <!-- Companies -->
        <?php if ( ! $atts['company_slug'] ) : ?>
        <div class="pfg-section">
            <h2 class="pfg-section-title">Companies</h2>
            <?php
            global $wpdb;
            $co_table     = $wpdb->prefix . 'pfg_companies';
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $company_list = $wpdb->get_results( "SELECT * FROM {$co_table} ORDER BY name" );
            ?>
            <?php if ( $company_list ) : ?>
            <div style="overflow-x:auto;margin-bottom:1.5rem;">
            <table class="pfg-dash-table">
                <thead><tr><th>Logo</th><th>Name</th><th>Slug</th><th>Links &amp; Password</th><th>Del</th></tr></thead>
                <tbody>
                <?php foreach ( $company_list as $co ) :
                    // phpcs:disable WordPress.DB.DirectDatabaseQuery
                    $assess_post = $wpdb->get_row( $wpdb->prepare( "SELECT ID FROM {$wpdb->prefix}posts WHERE post_name = %s AND post_type = 'page' AND post_status = 'publish' LIMIT 1", $co->slug ) );
                    $dash_post   = $wpdb->get_row( $wpdb->prepare( "SELECT ID FROM {$wpdb->prefix}posts WHERE post_name = %s AND post_type = 'page' LIMIT 1", $co->slug . '-dashboard' ) );
                    $admin_post  = $wpdb->get_row( $wpdb->prepare( "SELECT ID FROM {$wpdb->prefix}posts WHERE post_name = %s AND post_type = 'page' LIMIT 1", $co->slug . '-admin' ) );
                    // phpcs:enable
                    $assess_url = $assess_post ? get_permalink( $assess_post->ID ) : '';
                    $dash_url   = $dash_post   ? get_permalink( $dash_post->ID )   : '';
                    $admin_url  = $admin_post  ? get_permalink( $admin_post->ID )  : '';
                    $dash_pass  = $admin_post  ? get_post_meta( $admin_post->ID, '_pfg_dashboard_password', true ) : '';
                ?>
                <tr>
                    <td style="width:56px;">
                        <?php if ( $co->logo_url ) : ?>
                            <img src="<?php echo esc_url( $co->logo_url ); ?>" alt="" style="max-height:36px;max-width:56px;object-fit:contain;">
                        <?php else : ?>
                            <span style="color:#94a3b8;font-size:0.75rem;">—</span>
                        <?php endif; ?>
                    </td>
                    <td><?php echo esc_html( $co->name ); ?></td>
                    <td style="color:#64748b;font-size:0.8rem;"><?php echo esc_html( $co->slug ); ?></td>
                    <td>
                        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                            <?php if ( $assess_url ) : ?>
                                <a href="<?php echo esc_url( $assess_url ); ?>" target="_blank" style="padding:3px 8px;background:#22C55E;color:#fff;border-radius:5px;font-size:0.75rem;text-decoration:none;font-weight:600;white-space:nowrap;">Assessment</a>
                            <?php endif; ?>
                            <?php if ( $dash_url ) : ?>
                                <a href="<?php echo esc_url( $dash_url ); ?>" target="_blank" style="padding:3px 8px;background:#3b82f6;color:#fff;border-radius:5px;font-size:0.75rem;text-decoration:none;font-weight:600;white-space:nowrap;">Dashboard</a>
                            <?php endif; ?>
                            <?php if ( $admin_url ) : ?>
                                <a href="<?php echo esc_url( $admin_url ); ?>" target="_blank" style="padding:3px 8px;background:#6366f1;color:#fff;border-radius:5px;font-size:0.75rem;text-decoration:none;font-weight:600;white-space:nowrap;">Admin</a>
                            <?php endif; ?>
                            <?php if ( $dash_pass ) : ?>
                                <span style="font-size:0.72rem;color:#64748b;white-space:nowrap;">Password: <code style="background:#f1f5f9;padding:1px 5px;border-radius:3px;"><?php echo esc_html( $dash_pass ); ?></code></span>
                            <?php endif; ?>
                        </div>
                    </td>
                    <td>
                        <button class="pfg-del-company-btn" data-id="<?php echo esc_attr( $co->id ); ?>"
                            style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-weight:700;">&#10005;</button>
                    </td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            </div>
            <?php else : ?>
            <p style="color:#94a3b8;font-size:0.875rem;margin-bottom:1.5rem;">No companies added yet.</p>
            <?php endif; ?>

            <form id="pfg-add-company-form" style="display:flex;flex-wrap:wrap;gap:0.75rem;align-items:flex-end;">
                <div class="pfg-field" style="flex:1;min-width:160px;">
                    <label>Company Name</label>
                    <input type="text" id="pfg-co-name" placeholder="e.g. Acme Corp" style="width:100%;">
                </div>
                <div class="pfg-field" style="flex:1;min-width:200px;">
                    <label>Logo <span class="pfg-optional">(optional)</span></label>
                    <div style="display:flex;gap:0.5rem;align-items:center;">
                        <input type="hidden" id="pfg-co-logo-url">
                        <span id="pfg-co-logo-preview" style="font-size:0.75rem;color:#64748b;">No file chosen</span>
                        <button type="button" id="pfg-co-logo-btn" class="pfg-btn-secondary" style="padding:0.4rem 0.9rem;font-size:0.8rem;width:auto;">Upload Logo</button>
                    </div>
                </div>
                <button type="submit" class="pfg-btn-primary" style="width:auto;padding:0.55rem 1.25rem;font-size:0.875rem;">Add Company</button>
            </form>
            <div id="pfg-co-error" style="display:none;color:#ef4444;margin-top:0.5rem;font-size:0.875rem;"></div>
        </div>
        <?php endif; ?>

    </div>
    <?php
    return ob_get_clean();
}

add_action( 'wp_ajax_pfg_delete_entry',        'pfg_delete_entry' );
add_action( 'wp_ajax_nopriv_pfg_delete_entry', 'pfg_delete_entry' );
function pfg_delete_entry() {
    check_ajax_referer( 'pfg_dashboard_nonce', 'nonce' );
    $id = isset( $_POST['id'] ) ? intval( $_POST['id'] ) : 0;
    if ( ! $id ) { wp_send_json_error( [ 'message' => 'Invalid ID.' ] ); }
    global $wpdb;
    $table = $wpdb->prefix . 'pfg_assessments';
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    $wpdb->delete( $table, [ 'id' => $id ], [ '%d' ] );
    wp_send_json_success();
}

add_action( 'wp_ajax_pfg_dashboard_data', 'pfg_ajax_dashboard_data' );
add_action( 'wp_ajax_nopriv_pfg_dashboard_data', 'pfg_ajax_dashboard_data' );
function pfg_ajax_dashboard_data() {
    check_ajax_referer( 'pfg_dashboard_nonce', 'nonce' );

    global $wpdb;
    $table = $wpdb->prefix . 'pfg_assessments';

    $filter_company      = isset( $_POST['company'] )      ? sanitize_text_field( wp_unslash( $_POST['company'] ) )      : '';
    $filter_dept         = isset( $_POST['dept'] )         ? sanitize_text_field( wp_unslash( $_POST['dept'] ) )         : '';
    $filter_date_from    = isset( $_POST['date_from'] )    ? sanitize_text_field( wp_unslash( $_POST['date_from'] ) )    : '';
    $filter_date_to      = isset( $_POST['date_to'] )      ? sanitize_text_field( wp_unslash( $_POST['date_to'] ) )      : '';
    $filter_company_slug = isset( $_POST['company_slug'] ) ? sanitize_text_field( wp_unslash( $_POST['company_slug'] ) ) : '';

    $locked_company = '';
    if ( $filter_company_slug ) {
        $co_tbl = $wpdb->prefix . 'pfg_companies';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $locked_company = (string) $wpdb->get_var( $wpdb->prepare( "SELECT name FROM {$co_tbl} WHERE slug = %s", $filter_company_slug ) );
        if ( $locked_company ) $filter_company = $locked_company;
    }

    $where  = 'WHERE 1=1';
    $params = [];
    if ( $filter_company )   { $where .= ' AND company = %s';                          $params[] = $filter_company; }
    if ( $filter_dept )      { $where .= ' AND department = %s';                       $params[] = $filter_dept; }
    if ( $filter_date_from ) { $where .= ' AND DATE(submitted_at) >= %s';              $params[] = $filter_date_from; }
    if ( $filter_date_to )   { $where .= ' AND DATE(submitted_at) <= %s';              $params[] = $filter_date_to; }

    // phpcs:disable WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.NotPrepared
    if ( $params ) {
        $rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} {$where} ORDER BY submitted_at DESC", ...$params ), ARRAY_A );
    } else {
        $rows = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY submitted_at DESC", ARRAY_A );
    }

    foreach ( $rows as &$row ) {
        $row['tier']           = pfg_get_tier( (int) $row['total_score'] );
        $row['interpretation'] = pfg_get_interpretation( (int) $row['total_score'] );
    }
    unset( $row );

    $csf_keys = [ 'score_communication', 'score_knowledge', 'score_leadership', 'score_measurement',
                  'score_morale', 'score_process', 'score_recognition', 'score_resource_qty',
                  'score_resource_qual', 'score_standards' ];

    $comp_where = $locked_company ? $wpdb->prepare( "WHERE company = %s", $locked_company ) : '';

    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    $global_avg_total = (float) $wpdb->get_var( "SELECT AVG(total_score) FROM {$table} {$comp_where}" );
    $global_csf_avgs  = [];
    foreach ( $csf_keys as $col ) {
        $global_csf_avgs[ $col ] = round( (float) $wpdb->get_var( "SELECT AVG({$col}) FROM {$table} {$comp_where}" ), 1 );
    }

    $true_global_csf_avgs = [];
    foreach ( $csf_keys as $col ) {
        $true_global_csf_avgs[ $col ] = round( (float) $wpdb->get_var( "SELECT AVG({$col}) FROM {$table}" ), 1 );
    }
    // phpcs:enable

    if ( $locked_company ) {
        $depts = $wpdb->get_col( $wpdb->prepare( "SELECT DISTINCT department FROM {$table} WHERE company = %s ORDER BY department", $locked_company ) );
    } else {
        $depts = $wpdb->get_col( "SELECT DISTINCT department FROM {$table} ORDER BY department" );
    }
    $dept_avgs = [];
    foreach ( $depts as $dept ) {
        if ( $locked_company ) {
            $entry = [ 'department' => $dept, 'avg_total' => round( (float) $wpdb->get_var( $wpdb->prepare( "SELECT AVG(total_score) FROM {$table} WHERE company = %s AND department = %s", $locked_company, $dept ) ), 1 ) ];
            foreach ( $csf_keys as $col ) {
                $entry[ $col ] = round( (float) $wpdb->get_var( $wpdb->prepare( "SELECT AVG({$col}) FROM {$table} WHERE company = %s AND department = %s", $locked_company, $dept ) ), 1 );
            }
        } else {
            $entry = [ 'department' => $dept, 'avg_total' => round( (float) $wpdb->get_var( $wpdb->prepare( "SELECT AVG(total_score) FROM {$table} WHERE department = %s", $dept ) ), 1 ) ];
            foreach ( $csf_keys as $col ) {
                $entry[ $col ] = round( (float) $wpdb->get_var( $wpdb->prepare( "SELECT AVG({$col}) FROM {$table} WHERE department = %s", $dept ) ), 1 );
            }
        }
        $dept_avgs[] = $entry;
    }

    $companies   = $locked_company
        ? [ $locked_company ]
        : $wpdb->get_col( "SELECT DISTINCT company FROM {$table} ORDER BY company" );
    $departments = $locked_company
        ? $wpdb->get_col( $wpdb->prepare( "SELECT DISTINCT department FROM {$table} WHERE company = %s ORDER BY department", $locked_company ) )
        : $wpdb->get_col( "SELECT DISTINCT department FROM {$table} ORDER BY department" );

    $company_dept_map = [];
    foreach ( $companies as $co ) {
        $company_dept_map[ $co ] = $wpdb->get_col( $wpdb->prepare( "SELECT DISTINCT department FROM {$table} WHERE company = %s ORDER BY department", $co ) );
    }

    $company_avgs = [];
    foreach ( $companies as $co ) {
        $entry = [ 'company' => $co, 'avg_total' => round( (float) $wpdb->get_var( $wpdb->prepare( "SELECT AVG(total_score) FROM {$table} WHERE company = %s", $co ) ), 1 ) ];
        foreach ( $csf_keys as $col ) {
            $entry[ $col ] = round( (float) $wpdb->get_var( $wpdb->prepare( "SELECT AVG({$col}) FROM {$table} WHERE company = %s", $co ) ), 1 );
        }
        $company_avgs[] = $entry;
    }
    // phpcs:enable

    wp_send_json_success( [
        'rows'                 => $rows,
        'global_avg_total'     => round( $global_avg_total, 1 ),
        'global_csf_avgs'      => $global_csf_avgs,
        'true_global_csf_avgs' => $true_global_csf_avgs,
        'dept_avgs'            => $dept_avgs,
        'company_avgs'         => $company_avgs,
        'company_dept_map'     => $company_dept_map,
        'companies'            => $companies,
        'departments'          => $departments,
    ] );
}

// ─── COMPANY MANAGEMENT ───────────────────────────────────────────────────
add_action( 'wp_ajax_pfg_add_company',        'pfg_add_company' );
add_action( 'wp_ajax_nopriv_pfg_add_company', 'pfg_add_company' );
function pfg_add_company() {
    check_ajax_referer( 'pfg_dashboard_nonce', 'nonce' );
    $name     = sanitize_text_field( wp_unslash( $_POST['name'] ?? '' ) );
    $logo_url = esc_url_raw( wp_unslash( $_POST['logo_url'] ?? '' ) );
    if ( ! $name ) { wp_send_json_error( [ 'message' => 'Company name is required.' ] ); }
    $slug = sanitize_title( $name );
    global $wpdb;
    $table  = $wpdb->prefix . 'pfg_companies';
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    $result = $wpdb->insert( $table, [ 'name' => $name, 'slug' => $slug, 'logo_url' => $logo_url ] );
    if ( false === $result ) { wp_send_json_error( [ 'message' => 'Could not add company. Name may already exist.' ] ); }

    $assess_id = wp_insert_post( [
        'post_title'   => $name,
        'post_name'    => $slug,
        'post_content' => "[pfg_assessment company_slug='{$slug}']",
        'post_status'  => 'publish',
        'post_type'    => 'page',
    ] );
    if ( $assess_id && ! is_wp_error( $assess_id ) ) {
        update_post_meta( $assess_id, '_pfg_generated_page', '1' );
    }

    $dash_id = wp_insert_post( [
        'post_title'   => $name . ' Dashboard',
        'post_name'    => $slug . '-dashboard',
        'post_content' => "[pfg_admin_dashboard company_slug='{$slug}']",
        'post_status'  => 'publish',
        'post_type'    => 'page',
    ] );
    if ( $dash_id && ! is_wp_error( $dash_id ) ) {
        update_post_meta( $dash_id, '_pfg_generated_page', '1' );
    }

    $dash_password = wp_generate_password( 12, false );
    $admin_id = wp_insert_post( [
        'post_title'   => $name . ' Admin',
        'post_name'    => $slug . '-admin',
        'post_content' => "[pfg_client_login company_slug='{$slug}']",
        'post_status'  => 'publish',
        'post_type'    => 'page',
    ] );
    if ( $admin_id && ! is_wp_error( $admin_id ) ) {
        update_post_meta( $admin_id, '_pfg_generated_page', '1' );
        update_post_meta( $admin_id, '_pfg_dashboard_password', $dash_password );
    }

    wp_send_json_success( [
        'assess_url'    => ( $assess_id && ! is_wp_error( $assess_id ) ) ? get_permalink( $assess_id ) : '',
        'dash_url'      => ( $dash_id   && ! is_wp_error( $dash_id ) )   ? get_permalink( $dash_id )   : '',
        'admin_url'     => ( $admin_id  && ! is_wp_error( $admin_id ) )  ? get_permalink( $admin_id )  : '',
        'dash_password' => $dash_password,
    ] );
}

add_action( 'wp_ajax_pfg_delete_company',        'pfg_delete_company' );
add_action( 'wp_ajax_nopriv_pfg_delete_company', 'pfg_delete_company' );
function pfg_delete_company() {
    check_ajax_referer( 'pfg_dashboard_nonce', 'nonce' );
    $id = isset( $_POST['id'] ) ? intval( $_POST['id'] ) : 0;
    if ( ! $id ) { wp_send_json_error( [ 'message' => 'Invalid ID.' ] ); }
    global $wpdb;
    $co_table  = $wpdb->prefix . 'pfg_companies';
    $ass_table = $wpdb->prefix . 'pfg_assessments';
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    $name = $wpdb->get_var( $wpdb->prepare( "SELECT name FROM {$co_table} WHERE id = %d", $id ) );
    if ( ! $name ) { wp_send_json_error( [ 'message' => 'Company not found.' ] ); }

    foreach ( [ $name, $name . ' Dashboard', $name . ' Admin' ] as $page_title ) {
        $pages = get_posts( [
            'post_type'   => 'page',
            'post_status' => 'any',
            'numberposts' => -1,
            'title'       => $page_title,
            'meta_query'  => [ [ 'key' => '_pfg_generated_page', 'value' => '1' ] ],
        ] );
        foreach ( $pages as $page ) {
            wp_delete_post( $page->ID, true );
        }
    }

    // phpcs:disable WordPress.DB.DirectDatabaseQuery
    $wpdb->delete( $ass_table, [ 'company' => $name ], [ '%s' ] );
    $wpdb->delete( $co_table,  [ 'id' => $id ],        [ '%d' ] );
    // phpcs:enable
    wp_send_json_success();
}

// ─── CSV EXPORT ───────────────────────────────────────────────────────────
add_action( 'admin_post_pfg_export_csv', 'pfg_export_csv' );
function pfg_export_csv() {
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_die( 'Unauthorised.' );
    }

    global $wpdb;
    $table = $wpdb->prefix . 'pfg_assessments';
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    $rows  = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY submitted_at DESC", ARRAY_A );

    $filename = 'pfg-assessments-' . gmdate( 'Y-m-d' ) . '.csv';
    header( 'Content-Type: text/csv; charset=utf-8' );
    header( 'Content-Disposition: attachment; filename="' . $filename . '"' );

    $out = fopen( 'php://output', 'w' );
    fputcsv( $out, [
        'ID', 'Name', 'Company', 'Department', 'Email',
        'Communication', 'Knowledge', 'Leadership', 'Measurement', 'Morale',
        'Process', 'Recognition', 'Resource Qty', 'Resource Qual', 'Standards',
        'Total Score', 'Tier', 'Submitted At',
    ] );

    foreach ( $rows as $row ) {
        fputcsv( $out, [
            $row['id'],
            $row['user_name'],
            $row['company'],
            $row['department'],
            $row['email'],
            $row['score_communication'],
            $row['score_knowledge'],
            $row['score_leadership'],
            $row['score_measurement'],
            $row['score_morale'],
            $row['score_process'],
            $row['score_recognition'],
            $row['score_resource_qty'],
            $row['score_resource_qual'],
            $row['score_standards'],
            $row['total_score'],
            pfg_get_tier( (int) $row['total_score'] ),
            $row['submitted_at'],
        ] );
    }
    fclose( $out );
    exit;
}
