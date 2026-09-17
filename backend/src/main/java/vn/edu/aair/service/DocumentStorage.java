package vn.edu.aair.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Service
public class DocumentStorage {
    public byte[] readPdf(MultipartFile file) throws IOException {
        if(file.isEmpty() || file.getSize()>50L*1024*1024) throw WorkspaceService.error(HttpStatus.BAD_REQUEST,"Tệp phải có nội dung và không quá 50 MB");
        String name=file.getOriginalFilename()==null?"document":file.getOriginalFilename();
        if(name.length()>255 || !name.toLowerCase().endsWith(".pdf"))
            throw WorkspaceService.error(HttpStatus.BAD_REQUEST,"Chỉ hỗ trợ file PDF; tên tệp tối đa 255 ký tự");
        byte[] content=file.getBytes();
        if(content.length<5 || !new String(content,0,5,StandardCharsets.US_ASCII).equals("%PDF-"))
            throw WorkspaceService.error(HttpStatus.BAD_REQUEST,"Nội dung tệp không phải PDF hợp lệ");
        return content;
    }
}
