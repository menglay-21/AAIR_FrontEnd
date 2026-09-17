package vn.edu.aair.service;

import jakarta.mail.MessagingException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AccountMailService {
    private static final Logger LOG = LoggerFactory.getLogger(AccountMailService.class);
    private final JavaMailSender mailSender;
    private final String from;

    public AccountMailService(JavaMailSender mailSender, @Value("${app.mail.from:}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    public void sendCredentials(String recipient, String username, String password, String role) {
        if (from == null || from.isBlank()) {
            throw WorkspaceService.error(HttpStatus.SERVICE_UNAVAILABLE,
                    "Chưa cấu hình MAIL_USERNAME/MAIL_FROM để gửi thông tin đăng nhập");
        }
        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(from);
            helper.setTo(recipient);
            helper.setSubject("Thông báo tài khoản AAIR đã được tạo");
            helper.setText(buildCredentialsEmail(username, password, role), true);
            mailSender.send(message);
        } catch (MailException | MessagingException exception) {
            LOG.error("Không gửi được email thông tin đăng nhập tới {}", recipient, exception);
            throw WorkspaceService.error(HttpStatus.SERVICE_UNAVAILABLE,
                    "Không gửi được email; tài khoản chưa được tạo");
        }
    }

    private String buildCredentialsEmail(String username, String password, String role) {
        String safeUsername = escapeHtml(username);
        String safePassword = escapeHtml(password);
        String safeRole = escapeHtml(role);
        String loginUrl = "https://aair.example.com/login";
        return """
                <!doctype html>
                <html lang="vi">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <meta http-equiv="X-UA-Compatible" content="IE=edge">
                  <title>Thông báo tài khoản AAIR đã được tạo</title>
                </head>
                <body style="margin:0; padding:0; background-color:#f3f4f8; font-family:Arial, Helvetica, sans-serif; color:#242635;">
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="width:100%%; background-color:#f3f4f8; margin:0; padding:24px 12px;">
                    <tr>
                      <td align="center" style="padding:0;">
                        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%%; max-width:600px; background-color:#ffffff; border-collapse:collapse; border-radius:14px; overflow:hidden;">
                          <tr>
                            <td style="background-color:#7b1fb3; padding:28px 32px; text-align:left;">
                              <div style="font-size:28px; line-height:34px; font-weight:700; letter-spacing:1px; color:#ffffff;">AAIR</div>
                              <div style="font-size:14px; line-height:20px; color:#efe3f8; margin-top:6px;">Thông tin tài khoản của bạn</div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:32px;">
                              <h1 style="margin:0 0 14px; font-size:22px; line-height:30px; font-weight:700; color:#242635;">Tài khoản AAIR đã được tạo</h1>
                              <p style="margin:0 0 18px; font-size:15px; line-height:24px; color:#4b4f63;">Xin chào, tài khoản AAIR của bạn đã sẵn sàng. Vui lòng dùng thông tin bên dưới để đăng nhập lần đầu.</p>
                              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="width:100%%; background-color:#f6f7fb; border:1px solid #e1e4ee; border-radius:10px; border-collapse:separate; margin:24px 0;">
                                <tr>
                                  <td style="padding:20px 22px;">
                                    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="width:100%%; border-collapse:collapse;">
                                      <tr>
                                        <td style="padding:0 0 12px; font-size:13px; line-height:20px; color:#6a7084; width:38%%;">Tên đăng nhập</td>
                                        <td style="padding:0 0 12px; font-size:15px; line-height:20px; font-weight:700; color:#242635;">%s</td>
                                      </tr>
                                      <tr>
                                        <td style="padding:0 0 12px; font-size:13px; line-height:20px; color:#6a7084; width:38%%;">Mật khẩu ban đầu</td>
                                        <td style="padding:0 0 12px; font-family:'Courier New', Courier, monospace; font-size:15px; line-height:20px; font-weight:700; color:#242635; word-break:break-all;">%s</td>
                                      </tr>
                                      <tr>
                                        <td style="padding:0; font-size:13px; line-height:20px; color:#6a7084; width:38%%;">Vai trò</td>
                                        <td style="padding:0; font-size:15px; line-height:20px; font-weight:700; color:#242635;">%s</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </table>
                              <p style="margin:0 0 24px; font-size:15px; line-height:24px; color:#4b4f63;">Sau khi đăng nhập, bạn nên đổi mật khẩu ngay để bảo vệ tài khoản.</p>
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                                <tr>
                                  <td bgcolor="#7b1fb3" style="border-radius:8px;">
                                    <a href="%s" target="_blank" style="display:inline-block; padding:13px 24px; font-size:15px; line-height:20px; font-weight:700; color:#ffffff; text-decoration:none; background-color:#7b1fb3; border-radius:8px;">Đăng nhập ngay</a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr>
                            <td style="background-color:#fafbfe; border-top:1px solid #e8ebf2; padding:20px 32px;">
                              <p style="margin:0 0 8px; font-size:12px; line-height:18px; color:#7a8094;">Đây là email tự động từ hệ thống AAIR. Vui lòng không trả lời trực tiếp email này.</p>
                              <p style="margin:0 0 8px; font-size:12px; line-height:18px; color:#7a8094;">Cần hỗ trợ? Liên hệ: support@aair.example.com</p>
                              <p style="margin:0; font-size:12px; line-height:18px; color:#7a8094;">Nếu bạn không yêu cầu tạo tài khoản này, vui lòng bỏ qua email.</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(safeUsername, safePassword, safeRole, loginUrl);
    }

    private String escapeHtml(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
