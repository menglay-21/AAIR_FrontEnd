package vn.edu.aair.util;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class PasswordGenerator {

    public static void main(String[] args) {
        BCryptPasswordEncoder encoder =
                new BCryptPasswordEncoder(10);

        System.out.println("ur password is " + 
                encoder.encode("reviewer2@123")
        );
    }
}